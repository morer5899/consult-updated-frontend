import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
   server: {
    host: true, // Allow access from local network (0.0.0.0)
    port: 5173  // Optional: specify a port
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});