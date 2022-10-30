import { OrbitControls } from "@react-three/drei";
import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Test from "./Test";
import "./styles.css";

export default function App() {
  return (
    <div className="App">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 2], fov: 60 }}
        gl={{
          powerPreference: "high-performance",
          antialias: false,
          stencil: false,
          depth: false
        }}
      >
        <color args={["black"]} attach="background" />
        <Suspense fallback={null}>
          <Test />
        </Suspense>
        <OrbitControls zoomSpeed={0.75} />
      </Canvas>
    </div>
  );
}
