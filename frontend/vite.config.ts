/// <reference types="vitest" />
/// <reference types="vite/client" />

import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import cesium from 'vite-plugin-cesium'
import tailwindcss from '@tailwindcss/vite'

export default {
  plugins: [react(), viteTsconfigPaths(), svgrPlugin(), cesium(), tailwindcss()],
  build: {
    outDir: 'build',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      reporters: ['default', 'lcov'],
      include: ['src/**/*'],
      exclude: [
        'src/themes/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/model/**',
        'src/ApiEndpoints/**',
        'src/**/__tests__/**',
      ],
    },
    ...(process.env.CI && { minThreads: 1, maxThreads: 1 }),
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
};