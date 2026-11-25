import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Every URL starting with /api goes to Express. Never name a file or folder under
    // src/web "api…" — Vite would forward that module to Express and the page would load
    // blank (guarded by src/web/devServer.test.ts).
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
