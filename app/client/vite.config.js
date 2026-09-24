import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` buiten Docker: /api naar een lokaal draaiende server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
