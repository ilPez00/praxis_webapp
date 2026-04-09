import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'oxc',
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) return 'react-core';
          if (id.includes('node_modules/@mui/x-charts/') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/@mui/material/') || id.includes('node_modules/@emotion/')) return 'mui';
          if (id.includes('node_modules/@mui/icons-material/')) return 'mui-icons';
          if (id.includes('node_modules/@supabase/')) return 'supabase';
          if (id.includes('node_modules/leaflet/')) return 'leaflet';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mui/material/CircularProgress', '@mui/material/Box', '@mui/material/Stack', '@mui/material/Typography'],
  },
})
