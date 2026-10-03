/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // 监听全部网卡：本机 localhost:5173 与局域网（如 http://192.168.77.1:5173）均可访问
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
  css: { devSourcemap: false },
  optimizeDeps: {
    include: ['antd', '@ant-design/icons', '@ant-design/icons/MessageOutlined'],
  },
  test: {
    pool: 'vmThreads',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/tests/setup.ts'],
    css: false,
  },
});
