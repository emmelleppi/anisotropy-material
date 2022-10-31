import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  DepthOfFieldEffect,
  BloomEffect,
} from "postprocessing";



function usePostprocessing(roughness) {
  const { gl, scene, size, camera } = useThree();

  const [composer, bloomEfx] = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 4
    });
    const renderPass = new RenderPass(scene, camera);

    const DOF = new DepthOfFieldEffect(camera, {
      worldFocusDistance: 1.5,
      worldFocusRange: 1.5,
      bokehScale: 2
    });
    const BLOOM = new BloomEffect();

    composer.addPass(renderPass);
    composer.addPass(new EffectPass(camera, DOF, BLOOM));

    return [composer, BLOOM];
  }, [gl, scene, camera]);

  useEffect(() => void composer.setSize(size.width, size.height), [
    composer,
    size
  ]);

  useFrame((_, delta) => {
    composer.render(delta);

    const bloomResolution = 360;
    const bloomKernelSize = 2;
    const bloomBlurScale = 1;
    const bloomIntensity = 0.3 + (1 - roughness);
    const bloomThreshold = 0.9;
    const bloomSmoothing = 0.1;

    bloomEfx.resolution.height = bloomResolution;
    bloomEfx.blurPass.kernelSize = bloomKernelSize;
    bloomEfx.blurPass.scale = bloomBlurScale;
    bloomEfx.intensity = bloomIntensity;
    bloomEfx.luminanceMaterial.threshold = bloomThreshold;
    bloomEfx.luminanceMaterial.smoothing = bloomSmoothing;
  }, 1);
}

export default usePostprocessing;
