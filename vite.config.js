import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    // HMR disabled: in proxied dev environments (e.g. GitHub Codespaces) the
    // default WS server tries to bind to a public host and fails. A full
    // page reload after edits is sufficient for this tool.
    hmr: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
