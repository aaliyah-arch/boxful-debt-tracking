// 把 vite build 產生的 dist/ 合併成單一 HTML 檔（dist-gas/index.html），
// 可直接貼進 Google Apps Script 專案的 index.html。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const read = (ref) => readFileSync(join(dist, ref.replace(/^\.?\//, '')), 'utf8');

// favicon 在 Apps Script 不會用到
html = html.replace(/<link rel="icon"[^>]*>\s*/g, '');

// <link rel="modulepreload"> 不需要
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

// CSS → <style>
html = html.replace(/<link rel="stylesheet"[^>]*href="(\.?\/?assets\/[^"]+\.css)"[^>]*>/g, (_, href) =>
  `<style>\n${read(href)}\n</style>`
);

// JS → 內嵌 <script type="module">（避免程式碼中的 </script> 截斷 HTML）
html = html.replace(/<script type="module"[^>]*src="(\.?\/?assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, src) =>
  `<script type="module">\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`
);

// 腳本必須放在 #root 之後執行
const scripts = [];
html = html.replace(/<script type="module">[\s\S]*?\n<\/script>/g, (m) => {
  scripts.push(m);
  return '';
});
html = html.replace('</body>', () => `${scripts.join('\n')}\n</body>`);

if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) {
  throw new Error('仍有未內嵌的 assets 參照，請檢查 dist/index.html');
}

mkdirSync(join(root, 'dist-gas'), { recursive: true });
writeFileSync(join(root, 'dist-gas', 'index.html'), html);
console.log(`dist-gas/index.html 完成（${(html.length / 1024).toFixed(0)} KB）`);
