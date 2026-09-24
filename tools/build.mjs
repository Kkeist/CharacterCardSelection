// 发布构建：白名单拷贝到 dist/，拷完自检，不过就报错退出。
// 发布目录只能是 dist/；仓库根目录里的编辑器配置、备份题库、图标源图、脚本都不会出现在网上。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_DIR = 'dist';

// 网页运行时需要的全部文件；dist 里出现此表之外的文件即自检失败
const PUBLISH_FILES = [
  'index.html',
  'styles.css',
  'questions.js',
  'app.js',
  'manifest.json',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'kk-avatar.png',
];
const HEADERS_SOURCE = 'tools/_headers';
const HEADERS_OUT = '_headers';

// Cloudflare Pages：单文件 25 MiB、总文件数 20000
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_COUNT = 20000;

const FORBIDDEN_DIRS = ['_build', '_test', 'tools', 'tests', 'node_modules', '.git', '.claude', '.idea'];
const FORBIDDEN_EXT = /\.(md|txt|bat|cmd|ps1|toml|mjs|cjs|map|log|iml|xml)$/i;
const FORBIDDEN_NAME = /backup|\.bak$|\.tmp$/i;

const abs = (...p) => path.join(ROOT, ...p);
const toPosix = (p) => p.split(path.sep).join('/');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

export function build() {
  const out = abs(OUT_DIR);
  fs.rmSync(out, { recursive: true, force: true });
  for (const f of PUBLISH_FILES) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.copyFileSync(abs(f), path.join(out, f));
  }
  fs.copyFileSync(abs(HEADERS_SOURCE), path.join(out, HEADERS_OUT));
  return check();
}

// 去掉查询串和锚点，忽略外链与 data: 地址；返回本地相对路径
function localRef(ref) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
  return ref.split(/[?#]/)[0].replace(/^\.\//, '').replace(/^\//, '') || null;
}

// 返回 { errors, warnings, fileCount, totalBytes }；errors 非空即不合格
export function check(dir = abs(OUT_DIR)) {
  const errors = [];
  const warnings = [];
  const files = walk(dir).map((f) => toPosix(path.relative(dir, f)));
  const allowed = new Set([...PUBLISH_FILES, HEADERS_OUT]);
  let totalBytes = 0;

  if (files.length > MAX_FILE_COUNT) errors.push(`文件数 ${files.length} 超过 ${MAX_FILE_COUNT}`);
  for (const f of files) {
    const parts = f.split('/');
    const name = parts[parts.length - 1];
    if (parts.slice(0, -1).some((p) => FORBIDDEN_DIRS.includes(p))) errors.push(`不该发布的目录: ${f}`);
    if (FORBIDDEN_EXT.test(name)) errors.push(`不该发布的文件类型: ${f}`);
    if (FORBIDDEN_NAME.test(name)) errors.push(`备份/临时文件: ${f}`);
    if (name.startsWith('.tmp') || name === '.DS_Store' || name === 'Thumbs.db') errors.push(`临时文件: ${f}`);
    if (!allowed.has(f)) errors.push(`不在发布白名单内: ${f}`);
    const size = fs.statSync(path.join(dir, f)).size;
    totalBytes += size;
    if (size > MAX_FILE_BYTES) errors.push(`超过单文件上限 25MiB: ${f} (${(size / 1048576).toFixed(1)}MiB)`);
  }

  const has = (rel) => fs.existsSync(path.join(dir, rel));

  if (!has('index.html')) {
    errors.push('缺少 index.html');
    return { errors, warnings, fileCount: files.length, totalBytes };
  }

  // index.html 里所有本地引用（script/link/img 等的 src、href）
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const r = localRef(m[1]);
    if (r && !has(r)) errors.push(`index.html 引用的文件不存在: ${m[1]}`);
  }

  // manifest.json 里的图标
  if (has('manifest.json')) {
    const web = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    for (const icon of web.icons || []) {
      const r = localRef(icon.src);
      if (r && !has(r)) errors.push(`manifest.json 图标不存在: ${icon.src}`);
    }
  }

  // styles.css 里的 url() 引用
  if (has('styles.css')) {
    const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const r = localRef(m[1]);
      if (r && !has(r)) errors.push(`styles.css 引用的文件不存在: ${m[1]}`);
    }
  }

  if (!has(HEADERS_OUT)) errors.push('缺少 _headers（缓存策略）');
  return { errors, warnings, fileCount: files.length, totalBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings, fileCount, totalBytes } = build();
  for (const w of warnings) console.warn(`警告: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`错误: ${e}`);
    process.exit(1);
  }
  console.log(`构建完成：${OUT_DIR}/ 共 ${fileCount} 个文件，${(totalBytes / 1024).toFixed(1)} KiB，自检通过`);
}
