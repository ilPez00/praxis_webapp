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
          // Separate cacheable chunks — a MUI update won't bust the React chunk
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'mui':        ['@mui/material', '@emotion/react', '@emotion/styled'],
          'mui-icons':  ['@mui/icons-material'],
          'supabase':   ['@supabase/supabase-js'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mui/material/CircularProgress', '@mui/material/Box', '@mui/material/Stack', '@mui/material/Typography'],
  },
})
