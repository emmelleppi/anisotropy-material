
varying vec3 v_viewPosition;
varying vec3 v_worldPosition;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying float v_bell;
varying float v_hammering;
varying float v_fogDepth;

uniform sampler2D u_cymbalMap;
uniform float u_bell;
uniform float u_body;

attribute vec4 tangent;

#ifndef saturate
    #define saturate( a ) clamp( a, 0.0, 1.0 )
#endif

void main () {
	vec4 transformed = vec4(position, 1.0);
	
	vec4 cymbal = texture2D(u_cymbalMap, uv);
	bool isBell = cymbal.a > 0.9;
	float displacement = cymbal.b * (isBell ? u_bell : -u_body);

	transformed.z += displacement;

	vec4 mvPosition = modelViewMatrix * transformed;
	gl_Position = projectionMatrix * mvPosition;

	vec3 normal = vec3((cymbal.xy - 0.5) * 1.0, 1.0);
	vec3 transformedNormal = normalMatrix * normalize(normal);
	#ifdef FLIP_SIDED
		transformedNormal = - transformedNormal;
	#endif

	vec3 objectTangent = vec3( tangent.xyz );
	vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif

	v_viewPosition = mvPosition.xyz;
	v_worldPosition = (modelMatrix * transformed).xyz;
	v_uv = uv;
	v_normal = normalize( transformedNormal );
	v_tangent = normalize( transformedTangent );
	v_bitangent = normalize( cross( v_normal, v_tangent ) * tangent.w );
	v_fogDepth = - mvPosition.z;
	v_bell = isBell ? pow(1.0 - 0.8 * cymbal.b, 2.0) : 1.0;

	v_hammering = isBell ? smoothstep(-0.5, 0.5, cymbal.b) : 0.0;
	v_hammering += isBell ? 0.0 : smoothstep(0.1, 0.0, pow(1.0 - cymbal.b, 8.0));
	v_hammering = 1.0 - v_hammering;
}
