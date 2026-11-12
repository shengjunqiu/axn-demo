import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import base from './vite.config';

/**
 * 单文件构建：产出一份自包含的 HTML（双击打开即可演示，无需服务器）。
 *
 * - inlineDynamicImports：把 React.lazy 的懒加载 chunk 合并进主 bundle，
 *   否则 file:// 下 import() 外部文件会被 CORS 拦掉。
 * - cssCodeSplit:false + 超大 assetsInlineLimit：CSS 与字体（woff2）全部内联。
 * - rollupOptions 整体替换（不是合并）：基础配置里的手动分包 manualChunks
 *   与 inlineDynamicImports 互斥，Rollup 直接报错。
 * 剩下的内联 / 图片转 base64 在 scripts/build-single.mjs 里做。
 */
const merged = mergeConfig(
  base,
  defineConfig({
    base: './',
    build: {
      outDir: 'dist-single',
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    },
  }),
) as UserConfig;

merged.build!.rollupOptions = { output: { inlineDynamicImports: true } };

export default merged;
