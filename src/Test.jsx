import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { generateTangents } from "mikktspace";
import { useNormalTexture, useTexture } from "@react-three/drei";

import usePostprocessing from "./usePostprocessing";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

const rand = Math.random();

export default function Model() {
  usePostprocessing();

  const [mesh, setMesh] = useState();
  const uniforms = useMemo(
    () => ({
          u_dt: { value: 0 },
          u_time: { value: 0 },
          
          u_color: { value: new THREE.Color("#DAA520") },
          
          u_roughness: { value: 0.5 },
          
          u_lut: { value: null },
          u_envDiffuse: {value: null},
          u_envSpecular: {value: null},
          
          u_normalMap: { value: null },
          u_normalScale: { value: new THREE.Vector2(1, 1) },
          
          u_anisotropyFactor: { value: 1 },
          u_anisotropyMap: { value: null },
          u_anisotropyRotationMap: { value: null },
          
          u_repeat: { value: new THREE.Vector2(1, 1) },        
        }),
    []
  );


  const { color, roughnessFactor, normalScale, anisotropyFactor, normalId, repeat } = useControls({
    color: "#DAA520",
    roughnessFactor: { min: 0, max: 1, step: 0.0001, value: 0.5 },
    anisotropyFactor: { min: 0, max: 1, step: 0.0001, value: 1 },
    normalScale: { min: 0, max: 1, step: 0.0001, value: 0.1 },
    normalId: { min: 1, max: 70, step: 1, value: 10 },
    repeat: { min: 1, max: 16, step: 0.0001, value: 8 },
  });

  const [lut, envDiffuse, envSpecular, anisotropyMap, anisotropyRotationMap] = useTexture([
    "/lut.png",
    "/env_diffuse.png",
    "/env_specular.png",
    "/anisotropy.jpg",
    "/anisotropy_rotation.jpg",
  ])

  const gl = useThree(s => s.gl)
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
  const [normalMap] = useNormalTexture(normalId)

  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
  anisotropyMap.wrapS = anisotropyMap.wrapT = THREE.RepeatWrapping
  anisotropyRotationMap.wrapS = anisotropyRotationMap.wrapT = THREE.RepeatWrapping
  normalMap.anisotropy = anisotropyMap.anisotropy = anisotropyRotationMap.anisotropy = maxAnisotropy

  lut.generateMipmaps = false;
  lut.flipY = true;
  lut.needsUpdate = true;

  envDiffuse.generateMipmaps = false;
  envDiffuse.flipY = true;
  envDiffuse.needsUpdate = true;

  envSpecular.generateMipmaps = false;
  envSpecular.flipY = true;
  envSpecular.needsUpdate = true;


  useEffect(() => {
    if (!mesh) return;

    const {position, normal, uv} = mesh.geometry.attributes
		const tangents = generateTangents(position.array, normal.array, uv.array);
		const _tangents = new Float32Array(tangents.length + 4);
		for (let i = 0; i < tangents.length; i++) {
			_tangents[i] = tangents[i]
		}
		_tangents[tangents.length + 0] = 1
		_tangents[tangents.length + 1] = 0
		_tangents[tangents.length + 2] = 0
		_tangents[tangents.length + 3] = -1

		mesh.geometry.setAttribute('tangent', new THREE.BufferAttribute(_tangents, 4));
  }, [mesh]);

  useFrame((_, dt) => {
    mesh.material.uniforms.u_dt.value = dt;
    mesh.material.uniforms.u_time.value += dt;

    mesh.material.uniforms.u_color.value.set(color)
    mesh.material.uniforms.u_lut.value = lut;
    mesh.material.uniforms.u_envDiffuse.value = envDiffuse;
    mesh.material.uniforms.u_envSpecular.value = envSpecular;
    
    mesh.material.uniforms.u_roughness.value = roughnessFactor;
    
    mesh.material.uniforms.u_anisotropyFactor.value = anisotropyFactor;
    mesh.material.uniforms.u_anisotropyMap.value = anisotropyMap;
    mesh.material.uniforms.u_anisotropyRotationMap.value = anisotropyRotationMap;
    
    mesh.material.uniforms.u_normalMap.value = normalMap;
    mesh.material.uniforms.u_normalScale.value.setScalar(normalScale);
    
    mesh.material.uniforms.u_repeat.value.setScalar(repeat);
  });

  return (
    <mesh ref={setMesh} >
      <circleGeometry args={[1, 64, 64]} />
      <shaderMaterial
        key={rand}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={2}
      />
    </mesh>
  );
}
