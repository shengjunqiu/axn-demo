#!/usr/bin/env node
/**
 * 把 dist-single/ 打成一份自包含 HTML（双击可开的演示文件）。
 *
 * 做三件事：
 * 1. 把 <script src> / <link rel=stylesheet> 换成内联，去掉 modulepreload；
 * 2. 把 public/doc-assets 里的图片换成 data URI（原路径 /doc-assets/... 在 file:// 下会指向磁盘根）；
 * 3. 删掉 dist-single 里剩下的散件，只留 HTML。
 *
 * 用法：pnpm build:single
 */
import { readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist-single');
const publicDir = path.join(root, 'public');
const outName = '安小能-demo.html';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/** 内联进 <script>/<style> 前必须切断结束标签，否则 HTML 解析会提前收尾 */
function guard(code, tag) {
  const upper = code.toUpperCase();
  const lower = code.toLowerCase();
  const closer = `</${tag}>`;
  let out = '';
  let from = 0;
  for (let at = lower.indexOf(closer); at !== -1; at = lower.indexOf(closer, from)) {
    out += code.slice(from, at) + `<\\/`;
    out += upper.slice(at + 2, at + tag.length + 1);
    from = at + tag.length + 1;
  }
  return out + code.slice(from);
}

async function dataUri(file) {
  const buf = await readFile(file);
  const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** 递归列出目录下所有文件的绝对路径 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

let html = await readFile(path.join(distDir, 'index.html'), 'utf8');

// 1. 样式表 → <style>
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)) {
  const css = guard(await readFile(path.join(distDir, m[1].replace(/^\.?\//, '')), 'utf8'), 'style');
  // 用函数形式替换：bundle 里的 $& / $' 会被 String.replace 当成分组引用
  html = html.replace(m[0], () => `<style>\n${css}\n</style>`);
}

// 2. 入口脚本 → 内联 module
for (const m of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)) {
  const js = guard(await readFile(path.join(distDir, m[1].replace(/^\.?\//, '')), 'utf8'), 'script');
  html = html.replace(m[0], () => `<script type="module">\n${js}\n</script>`);
}

// modulepreload 指向的文件已合并/内联，删掉这些标签
html = html.replace(/[ \t]*<link[^>]+rel="modulepreload"[^>]*>\n?/g, '');

// 3. public 静态资源 → data URI（路径以绝对形式出现在 bundle 字符串里）
for (const file of await walk(publicDir)) {
  const url = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
  if (html.includes(url)) html = html.split(url).join(await dataUri(file));
}

// 4. 校验：不允许残留任何外部资源引用（file:// 下必然 404 / 被 CORS 拦）
const external = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(?!data:)([^"]*)"/g)].map((m) => m[0]);
if (external.length) {
  console.error(`✗ 仍有外部资源引用：\n  ${external.join('\n  ')}`);
  process.exit(1);
}

const outPath = path.join(distDir, outName);
await writeFile(outPath, html, 'utf8');

// 5. 只留 HTML
for (const name of await readdir(distDir)) {
  if (name !== outName) await rm(path.join(distDir, name), { recursive: true, force: true });
}

const { size } = await stat(outPath);
console.log(`✓ ${path.relative(root, outPath)}  ${(size / 1024 / 1024).toFixed(2)} MB（单文件，双击即可打开）`);
