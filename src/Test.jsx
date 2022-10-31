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

const TOT_PIXEL = 1024
const HALF_PIXEL = TOT_PIXEL * 0.5
const MAX_BELL = 0.1
const MAX_BODY = 0.1

const _v2 = new THREE.Vector2()
const _v3_0 = new THREE.Vector3()
const _v3_1 = new THREE.Vector3()
const _v3_2 = new THREE.Vector3()


export default function Model() {
  const [mesh, setMesh] = useState();
  
  const [cymbalTexture, ctx, imageData] = useState(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = TOT_PIXEL;
    const imageData = ctx.createImageData(TOT_PIXEL, TOT_PIXEL);
    
    return [new THREE.CanvasTexture(canvas), ctx, imageData];
  })[0];

  const uniforms = useMemo(
    () => ({
          u_dt: { value: 0 },
          u_time: { value: 0 },
          
          u_color: { value: new THREE.Color() },
          
          u_roughness: { value: 0.5 },
          
          u_lut: { value: null },
          u_envDiffuse: {value: null},
          u_envSpecular: {value: null},
          
          u_cymbalMap: { value: null },
          u_logo: { value: null },
          
          u_normalMap: { value: null },
          u_normalScale: { value: new THREE.Vector2(1, 1) },
          
          u_anisotropyFactor: { value: 1 },
          u_anisotropyMap: { value: null },
          u_anisotropyRotationMap: { value: null },
          
          u_repeat: { value: new THREE.Vector2(1, 1) },        
          
          u_bell: { value: MAX_BELL },
          u_body: { value: MAX_BODY },
        }),
    []
  );

  const { color, size, roughnessFactor, normalScale, anisotropyFactor, normalId, repeat, bellSize, bell, body } = useControls({
    color:{label: "Color",value: "#ffb74b"},
    size:{ label: "Size", min: 8, max: 24, step: 1, value: 18},
    roughnessFactor: {label:"Brilliant", min: 0, max: 1, step: 0.0001, value: 0.5 },
    anisotropyFactor: {label:"Opacity", min: 0, max: 1, step: 0.0001, value: 0.5 },
    normalId: {label:"Hammering Texture", min: 1, max: 70, step: 1, value: 50 },
    normalScale: {label:"Hammering Intensity", min: 0, max: 1, step: 0.0001, value: 0.5 },
    repeat: {label:"Hammering Density", min: 1, max: 16, step: 0.0001, value: 6 },
    bellSize: {label:"Bell Width", min: 0.15, max: 0.4, step: 0.0001, value: 0.25 },
    bell: {label:"Bell Depth", min: 0, max: MAX_BELL, step: 0.0001, value: MAX_BELL * 0.7 },
    body: {label:"Body Depth", min: 0, max: MAX_BODY, step: 0.0001, value: MAX_BODY * 0.5 },
  });

  usePostprocessing(roughnessFactor);

  useEffect(() => {
    let index = 0

    for (let i = 0; i < TOT_PIXEL; i++) {
      const x = i - HALF_PIXEL
      for (let j = 0; j < TOT_PIXEL; j++) {
        const y = j - HALF_PIXEL

        _v2.set(x, y)

        const dist = _v2.length() / HALF_PIXEL
        
        if (dist > bellSize) {
          // body
          imageData.data[index + 2] = ~~(Math.pow((dist - bellSize) / 0.75, 3) * body / MAX_BODY * 255)
          imageData.data[index + 3] = 200;
        } else {
          // bell
          imageData.data[index + 2] = ~~((1- Math.pow(dist / bellSize, 3)) * bell / MAX_BELL * 255)
          imageData.data[index + 3] = 255;
        }

        index += 4
      }
    }

    index = 0
    for (let i = 0; i < TOT_PIXEL; i++) {
      const x = i - HALF_PIXEL
      for (let j = 0; j < TOT_PIXEL; j++) {
        const y = j - HALF_PIXEL

        if (i + 8 > TOT_PIXEL - 1 || j + 8 > TOT_PIXEL - 1) {
          imageData.data[index] = imageData.data[index - 8]
          imageData.data[index + 1] = imageData.data[index + 1 - 8]
        } else {
          _v3_2.set(x, y, imageData.data[index + 2])
          _v3_0.set(x + 8, y, imageData.data[index + 2 + 8 * 4]).sub(_v3_2)
          _v3_1.set(x, y + 8, imageData.data[index + 2 + 8 * 4 * TOT_PIXEL]).sub(_v3_2)
          _v3_0.cross(_v3_1)
          _v3_0.normalize()

          imageData.data[index] = ~~((_v3_0.x + 0.5) * 255)
          imageData.data[index + 1] = ~~((_v3_0.y + 0.5) * 255)
        }

        index += 4
      }
    }

    ctx.putImageData(imageData, 0, 0);
    cymbalTexture.needsUpdate = true
  }, [bell, body, bellSize])

  const [lut, envDiffuse, envSpecular, anisotropyMap, anisotropyRotationMap, logo] = useTexture([
    "/lut.png",
    "/env_diffuse.png",
    "/env_specular.png",
    "/anisotropy.jpg",
    "/anisotropy_rotation.jpg",
    "/logo.png",
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
    
    mesh.material.uniforms.u_roughness.value = 1 - roughnessFactor;
    
    
    mesh.material.uniforms.u_anisotropyFactor.value = 1-anisotropyFactor;
    mesh.material.uniforms.u_anisotropyMap.value = anisotropyMap;
    mesh.material.uniforms.u_anisotropyRotationMap.value = anisotropyRotationMap;
    
    mesh.material.uniforms.u_normalMap.value = normalMap;
    mesh.material.uniforms.u_normalScale.value.setScalar(normalScale);
    
    mesh.material.uniforms.u_repeat.value.setScalar(repeat * size / 20);
    
    mesh.material.uniforms.u_cymbalMap.value = cymbalTexture
    mesh.material.uniforms.u_logo.value = logo
  });

  return (
    <mesh ref={setMesh} scale={size / 20}>
      <ringGeometry args={[0.03, 1, 64, 64]} />
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
