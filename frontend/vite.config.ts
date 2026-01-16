import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 9999,
    strictPort: true,
    hmr: {
      clientPort: 443
    },
    proxy: {
      '/api': 'http://localhost:9998',
      '/ws': {
        target: 'ws://localhost:9998',
        ws: true
      }
    }
  },
  build: {
    outDir: '../backend-node/static',
    emptyOutDir: true
  }
})
