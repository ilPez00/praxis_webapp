import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Ensure we use 'esnext' or similar to avoid issues with some mobile browsers
    // and disable any aggressive minification that might cause reference errors
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mui/material/CircularProgress', '@mui/material/Box', '@mui/material/Stack', '@mui/material/Typography'],
  },
})
