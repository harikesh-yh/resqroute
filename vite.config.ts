import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Everything the client needs is same-origin in dev, so there is no CORS story
// and no absolute backend URL baked into the bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/tiles': 'http://localhost:8787',
      // Glyphs and sprites. Deliberately not '/assets': that is Vite's own
      // build output directory, and the two would collide the moment we serve
      // a production build from the same origin.
      '/map-assets': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
