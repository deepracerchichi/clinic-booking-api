import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In development the page runs on Vite's port and forwards API calls to Express.
  server: { proxy: { '/slots': API, '/bookings': API, '/reset': API } },
});
