import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // the Arena preview proxies this dev server under a generated host name
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});
