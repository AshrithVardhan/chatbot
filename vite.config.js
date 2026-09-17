import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Local dev only: proxy /api → Express server on port 3001
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
