import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // En desarrollo, las llamadas a /api se reenvían al backend.
      proxy: {
        // xfwd: manda la IP real del dispositivo (X-Forwarded-For); el backend la guarda en tablets.ip.
        '/api': { target: process.env.API_URL || 'http://localhost:4000', xfwd: true },
      },
    },
  };
});
