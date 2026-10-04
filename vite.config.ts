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
      manualChunks(id) {
        // 只固定 React core（体积大、极少变动，命中长期缓存收益高）。
        //
        // antd 刻意不手动分包：手动把所有 antd 收进一个 vendor-antd，
        // 会让「只有懒加载 chunk 才用到的组件」（Table / DatePicker / Upload / Form …）
        // 与首屏共享同一个 chunk，从而被 modulepreload 一并预载 ——
        // 首屏白下载约 280KB(gzip) 的代码。
        // 交给 Rollup 按真实引用图切分，懒加载 chunk 各自携带自己用到的 antd 模块。
        if (
          id.includes('node_modules/react/') ||
          id.includes('node_modules/react-dom/') ||
          id.includes('node_modules/scheduler/')
        ) {
          return 'vendor-react';
        }
      },
      },
    },
  },
  css: { devSourcemap: false },
  optimizeDeps: {
    // 图标已迁移至 lucide-react，@ant-design/icons 仅作为 antd / @ant-design/x 的
    // 间接依赖存在，这里无需再显式预构建。
    include: ['antd'],
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
