import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const codespaceName = process.env.CODESPACE_NAME;
const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    hmr: codespaceName
      ? {
          host: `${codespaceName}-3001.${codespaceDomain}`,
          protocol: 'wss',
          clientPort: 443,
        }
      : undefined,
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
