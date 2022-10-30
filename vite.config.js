import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glslify from 'rollup-plugin-glslify';
import mkcert from 'vite-plugin-mkcert';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert(),
    wasm(),
    topLevelAwait(),
    glslify({
      compress: false, // disable it for now until we found a better solution
    })
  ]
})
