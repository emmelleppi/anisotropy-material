
varying vec3 v_viewPosition;
varying vec3 v_worldPosition;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;

attribute vec4 tangent;

void main () {
	vec4 transformed = vec4(position, 1.0);
	vec4 mvPosition = modelViewMatrix * transformed;
	gl_Position = projectionMatrix * mvPosition;

	vec3 transformedNormal = normalMatrix * normal;
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
}
