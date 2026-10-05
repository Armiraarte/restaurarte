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
        '/api': process.env.API_URL || 'http://localhost:4000',
      },
    },
  };
});
