uniform mat4 projectionMatrix;
uniform float u_time;
uniform float u_dt;

uniform vec3 u_color;

uniform vec2 u_normalScale;
uniform sampler2D u_normalMap;

uniform sampler2D u_logo;

uniform float u_roughness;

uniform sampler2D u_lut;
uniform sampler2D u_envDiffuse;
uniform sampler2D u_envSpecular;

uniform sampler2D u_anisotropyMap;
uniform float u_anisotropyFactor;
uniform sampler2D u_anisotropyRotationMap;

uniform vec2 u_repeat;

varying vec3 v_viewPosition;
varying vec3 v_worldPosition;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying float v_bell;
varying float v_hammering;
varying float v_fogDepth;

#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#define ENV_LODS 6.0
#define LN2 0.6931472

#ifndef saturate
    #define saturate( a ) clamp( a, 0.0, 1.0 )
#endif

float pow2( const in float x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }

vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
const float MIN_ROUGHNESS = 0.0525;

vec3 F_Schlick(vec3 f0, vec3 f90, float product) {
    float fresnel = exp2( ( - 5.55473 * product - 6.98316 ) * product );
    return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}

// https://github.com/repalash/Open-Shaders/blob/aede763ff6fb68c348092574d060c56200a255f5/Engines/filament/brdf.fs#L81
float D_GGX_Anisotropy(float at, float ab, float ToH, float BoH, float NoH) {
    // Burley 2012, "Physically-Based Shading at Disney"

    // The values at and ab are perceptualRoughness^2, a2 is therefore perceptualRoughness^4
    // The dot product below computes perceptualRoughness^8. We cannot fit in fp16 without clamping
    // the roughness to too high values so we perform the dot product and the division in fp32
    float a2 = at * ab;
    highp vec3 d = vec3(ab * ToH, at * BoH, a2 * NoH);
    highp float d2 = dot(d, d);
    float b2 = a2 / d2;
    return a2 * b2 * b2 * (1.0 / PI);
}

// https://github.com/repalash/Open-Shaders/blob/aede763ff6fb68c348092574d060c56200a255f5/Engines/filament/brdf.fs#L121
float V_GGX_SmithCorrelated_Anisotropy(float at, float ab, float ToV, float BoV, float ToL, float BoL, float NoV, float NoL) {
    // Heitz 2014, "Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs"
    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    float v = 0.5 / (lambdaV + lambdaL);
    return saturate( v );
}

// https://github.com/repalash/Open-Shaders/blob/f226a633874528ca1e7c3120512fc4a3bef3d1a6/Engines/filament/light_indirect.fs#L139
vec3 indirectAnisotropyBentNormal(float anisotropy, const in vec3 normal, const in vec3 viewDir, const in float roughness, const in vec3 anisotropicT, const in vec3 anisotropicB) {
    vec3 aDirection = anisotropy >= 0.0 ? anisotropicB : anisotropicT;
    vec3 aTangent = cross(aDirection, viewDir);
    vec3 aNormal = cross(aTangent, aDirection);
    float bendFactor = abs(anisotropy) * saturate(5.0 * max(roughness, MIN_ROUGHNESS));
    return normalize(mix(normal, aNormal, bendFactor));
}

//https://github.com/repalash/Open-Shaders/blob/f226a633874528ca1e7c3120512fc4a3bef3d1a6/Engines/filament/shading_model_standard.fs#L31
vec3 BRDF_GGX_Anisotropy(float anisotropy, const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 f0, const in vec3 f90, const in float roughness, const in vec3 anisotropicT, const in vec3 anisotropicB ) {
    float alpha = pow2( roughness ); // UE4's roughness

    vec3 halfDir = normalize( lightDir + viewDir );

    float dotNL = saturate( dot( normal, lightDir ) );
    float dotNV = saturate( dot( normal, viewDir ) );
    float dotNH = saturate( dot( normal, halfDir ) );
    float dotVH = saturate( dot( viewDir, halfDir ) );

    float dotTV =  dot(anisotropicT, viewDir) ;
    float dotBV =  dot(anisotropicB, viewDir) ;
    float dotTL =  dot(anisotropicT, lightDir) ;
    float dotBL =  dot(anisotropicB, lightDir) ;
    float dotTH =  dot(anisotropicT, halfDir) ;
    float dotBH =  dot(anisotropicB, halfDir) ;

    // Anisotropic parameters: at and ab are the roughness along the tangent and bitangent
    // to simplify materials, we derive them from a single roughness parameter
    // Kulla 2017, "Revisiting Physically Based Shading at Imageworks"
    float at = max(alpha * (1.0 + anisotropy), MIN_ROUGHNESS);
    float ab = max(alpha * (1.0 - anisotropy), MIN_ROUGHNESS);

    // specular anisotropic BRDF
    vec3 F = F_Schlick( f0, f90, dotVH );
    float V = V_GGX_SmithCorrelated_Anisotropy( at, ab, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
    float D = D_GGX_Anisotropy( at, ab, dotTH, dotBH, dotNH );

    return F * V * D;
}

vec4 SRGBtoLinear(vec4 srgb) {
    vec3 linOut = pow(srgb.xyz, vec3(2.2));
    return vec4(linOut, srgb.w);;
}

vec4 RGBMToLinear(in vec4 value) {
    float maxRange = 6.0;
    return vec4(value.xyz * value.w * maxRange, 1.0);
}

vec3 linearToSRGB(vec3 color) {
    return pow(color, vec3(1.0 / 2.2));
}

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec3 getIBLContribution(float NdV, float roughness, vec3 reflection, vec3 specularColor) {
	vec3 brdf = SRGBtoLinear(texture(u_lut, vec2(NdV, roughness))).rgb;

	// Sample 2 levels and mix between to get smoother degradation
	float blend = roughness * ENV_LODS;
	float level0 = floor(blend);
	float level1 = min(ENV_LODS, level0 + 1.0);
	blend -= level0;

	// Sample the specular env map atlas depending on the roughness value
	vec2 uvSpec = cartesianToPolar(reflection);
	uvSpec.y /= 2.0;
	vec2 uv0 = uvSpec;
	vec2 uv1 = uvSpec;
	uv0 /= pow(2.0, level0);
	uv0.y += 1.0 - exp(-LN2 * level0);
	uv1 /= pow(2.0, level1);
	uv1.y += 1.0 - exp(-LN2 * level1);
	vec3 specular0 = RGBMToLinear(texture(u_envSpecular, uv0)).rgb;
	vec3 specular1 = RGBMToLinear(texture(u_envSpecular, uv1)).rgb;
	vec3 specularLight = mix(specular0, specular1, blend);

	// Bit of extra reflection for smooth materials
	float reflectivity = pow((1.0 - roughness), 2.0) * 0.05;
	return specularLight * (specularColor * brdf.x + brdf.y + reflectivity);
}

void main () {
	vec3 lightPosition = vec3(5.0, 2.0, 2.0);

	float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;

	vec3 normal = normalize( v_normal );
	vec3 tangent = normalize( v_tangent );
	vec3 bitangent = normalize( v_bitangent );

	normal = normal * faceDirection;
	tangent = tangent * faceDirection;
	bitangent = bitangent * faceDirection;

	vec3 dxy = max( abs( dFdx( normal ) ), abs( dFdy( normal ) ) );
	float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );

	mat3 TBN = mat3( tangent, bitangent, normal );

	vec3 mapN = texture2D( u_normalMap, v_uv * u_repeat ).xyz * 2.0 - 1.0;
	mapN.xy *= u_normalScale * v_hammering;
	normal = normalize( TBN * mapN );

	vec3 N = inverseTransformDirection( normal, viewMatrix );
    vec3 L = normalize(lightPosition - v_worldPosition);
    vec3 V = normalize(cameraPosition - v_worldPosition);
    vec3 H = normalize(L + V);

	float roughnessFactor = u_roughness;
	float roughness = max( roughnessFactor, MIN_ROUGHNESS );
	roughness += geometryRoughness;
	roughness = min( roughness, 1.0 );

	float anisotropy = v_bell * u_anisotropyFactor * texture2D(u_anisotropyMap, v_uv).r;

    float logo = (1.0 - texture2D(u_logo, (vec2((gl_FrontFacing ? 0.0 : 1.0) + faceDirection * v_uv.x - 0.42,  2.0 * v_uv.y - 1.67) * 6.0)).a);
	vec3 specularColor = u_color * logo;

	vec3 specularEnvR0 = specularColor;
    vec3 specularEnvR90 = vec3(clamp(max(max(specularColor.r, specularColor.g), specularColor.b) * 25.0, 0.0, 1.0));

	float rot = (RGBMToLinear(texture2D(u_anisotropyRotationMap, v_uv)).r);
	rot = rot * 2.0 * PI;

	vec3 T = (tangent * sin(rot) + bitangent * cos(rot));
	T = normalize(T - N * dot(T, N));
	vec3 B = normalize(cross(N, T));

	vec3 direct = specularColor * BRDF_GGX_Anisotropy(anisotropy, L, V, N, specularEnvR0, specularEnvR90, roughness, T, B);

	vec3 bentNormal = indirectAnisotropyBentNormal(anisotropy, N, V, roughness, T, B);
	vec3 refl = reflect(-V, bentNormal);
	float NdV = clamp(abs(dot(N, V)), 0.001, 1.0);
    float NdL = saturate(dot(N, L));

    vec3 indirect = getIBLContribution(NdV, roughness, refl, specularColor);

	vec3 final = (NdL * direct + indirect);

	gl_FragColor = vec4(mix(final, linearToSRGB(final), logo), 1.0);

    float fogDensity = 0.25;
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * v_fogDepth * v_fogDepth );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3(1.0/255.0), fogFactor );
}
