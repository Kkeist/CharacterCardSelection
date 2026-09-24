import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, OUT_DIR, build, check } from './build.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('wrangler.toml 的输出目录是构建目录，不是仓库根', () => {
  const m = read('wrangler.toml').match(/^pages_build_output_dir\s*=\s*"([^"]+)"/m);
  assert.ok(m, 'wrangler.toml 缺少 pages_build_output_dir');
  assert.equal(m[1], OUT_DIR);
});

test('netlify.toml 的发布目录是构建目录，并先执行构建', () => {
  const toml = read('netlify.toml');
  assert.equal(toml.match(/^\s*publish\s*=\s*"([^"]+)"/m)?.[1], OUT_DIR);
  assert.equal(toml.match(/^\s*command\s*=\s*"([^"]+)"/m)?.[1], 'node tools/build.mjs');
});

test('.gitignore 忽略构建目录', () => {
  assert.ok(read('.gitignore').split(/\r?\n/).includes(`${OUT_DIR}/`));
});

test('_headers 给根路径单独写了缓存规则', () => {
  assert.match(read('tools/_headers'), /^\/\r?\n\s+Cache-Control:/m);
});

test('构建产物自检通过，且不含内部文件、备份题库和图标源图', () => {
  const { errors } = build();
  assert.deepEqual(errors, []);
  for (const f of ['questions.backup.js', 'favicon.png', 'wrangler.toml', 'netlify.toml', '.gitignore']) {
    assert.ok(!fs.existsSync(path.join(ROOT, OUT_DIR, f)), `${f} 不应出现在 ${OUT_DIR}/`);
  }
  for (const d of ['tools', '.idea', '.git']) {
    assert.ok(!fs.existsSync(path.join(ROOT, OUT_DIR, d)), `${d}/ 不应出现在 ${OUT_DIR}/`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, OUT_DIR, '_headers')));
});

test('首页有一处哐哐工作室标注：三行文案、指向个人站的新窗口链接、头像随包发布', () => {
  const html = read('index.html');
  assert.equal((html.match(/class="kk-credit"/g) || []).length, 1, '标注只放一处');
  for (const line of ['哐哐哐況 制作。', '全网同名，更多好玩的请前往→', '哐哐的个人站。']) {
    assert.ok(html.includes(line), `缺少文案: ${line}`);
  }
  assert.match(html, /<a class="kk-credit-link" href="https:\/\/kb\.kkeist\.com\/" target="_blank" rel="noopener">/);
  build();
  assert.ok(fs.existsSync(path.join(ROOT, OUT_DIR, 'kk-avatar.png')), '头像没有进发布目录');
  assert.match(read('index.html'), /src="kk-avatar\.png"/);
});

test('自检能拦住超大文件、内部文件、备份文件和缺失引用', () => {
  build();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardsel-dist-'));
  try {
    fs.cpSync(path.join(ROOT, OUT_DIR), tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'notes.md'), 'x');
    fs.writeFileSync(path.join(tmp, 'questions.backup.js'), 'x');
    fs.writeFileSync(path.join(tmp, 'favicon.png'), 'x');
    fs.mkdirSync(path.join(tmp, '.idea'));
    fs.writeFileSync(path.join(tmp, '.idea/misc.xml'), 'x');
    fs.writeFileSync(path.join(tmp, 'big.png'), Buffer.alloc(26 * 1024 * 1024));
    fs.rmSync(path.join(tmp, 'styles.css'));
    fs.rmSync(path.join(tmp, 'icon-192.png'));
    const { errors } = check(tmp);
    for (const key of ['notes.md', 'questions.backup.js', 'favicon.png', '.idea', 'big.png', 'styles.css', 'icon-192.png']) {
      assert.ok(errors.some((e) => e.includes(key)), `没拦住: ${key}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('自检能发现缺少 _headers', () => {
  build();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardsel-dist-'));
  try {
    fs.cpSync(path.join(ROOT, OUT_DIR), tmp, { recursive: true });
    fs.rmSync(path.join(tmp, '_headers'));
    assert.ok(check(tmp).errors.some((e) => e.includes('_headers')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
