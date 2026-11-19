import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app runs on http://localhost:5173 and every /api request
// is forwarded (proxied) to the Express backend - so there are no CORS problems.
const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
