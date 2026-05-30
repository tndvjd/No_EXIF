import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/](konva|react-konva)[\\/]/.test(id)) return 'canvas-vendor';
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons-vendor';
          return 'vendor';
        },
      },
    },
  },
});
