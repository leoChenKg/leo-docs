import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateContent } from './content.mjs';
import { collectPageRoutes, pageOutputPath, writePageEntries } from './pages.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'leo-pages-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, contents) => {
    const filename = path.join(root, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, contents);
  };
  return { root, write, output: path.join(root, 'dist') };
}

for (const base of ['/', '/leo-docs/']) {
  test(`copies the completed HTML shell unchanged for deployment base ${base}`, async (t) => {
    const { root, write, output } = await fixture(t);
    const html = `<!doctype html><html><head><script type="module" src="${base}assets/app-abc.js"></script><link rel="stylesheet" href="${base}assets/app-def.css"></head><body><div id="root"></div></body></html>`;
    await write('dist/index.html', html);
    await write('dist/assets/app-abc.js', 'window.loaded = true;');
    const routes = collectPageRoutes([{ slug: 'desktop', entries: [
      { route: '/spaces/desktop' },
      { route: '/spaces/desktop/delivery' },
      { route: '/spaces/desktop/delivery/发布流程' },
    ] }]);
    const files = await writePageEntries(output, routes);
    assert.deepEqual(files.sort(), [
      '.nojekyll', '404.html', 'bookmarks/index.html', 'search/index.html',
      'spaces/desktop/delivery/index.html', 'spaces/desktop/delivery/发布流程/index.html', 'spaces/desktop/index.html',
    ]);
    for (const route of routes) {
      assert.equal(await fs.readFile(path.join(output, pageOutputPath(route)), 'utf8'), html);
    }
    assert.equal(await fs.readFile(path.join(output, '404.html'), 'utf8'), html);
    assert.equal(await fs.readFile(path.join(output, '.nojekyll'), 'utf8'), '');
    assert.equal(await fs.readFile(path.join(output, 'assets/app-abc.js'), 'utf8'), 'window.loaded = true;');
    await assert.rejects(fs.stat(path.join(root, 'dist', 'leo-docs')), { code: 'ENOENT' });
  });
}

test('published content automatically supplies space, directory, and article paths', async (t) => {
  const { root, write, output } = await fixture(t);
  await write('spaces/desktop/space.yml', 'slug: desktop\ntitle: 桌面端');
  await write('spaces/desktop/_index.md', '# 桌面端');
  await write('spaces/desktop/delivery/release.md', '---\ntitle: 发布流程\n---\n# 发布流程');
  await write('spaces/desktop/delivery/draft.md', '---\ndraft: true\n---\n草稿');
  await write('spaces/desktop/secret/hidden.md', '---\nhidden: true\n---\n隐藏文章');
  await write('spaces/hidden/space.yml', 'slug: hidden\nhidden: true');
  await write('spaces/hidden/release.md', '# 隐藏空间文章');
  await write('spaces/empty/space.yml', 'slug: empty\ntitle: 空空间');
  await write('dist/index.html', '<div id="root"></div>');

  const spaces = await generateContent(root);
  const routes = collectPageRoutes(spaces);
  assert.deepEqual(routes, [
    '/', '/bookmarks', '/search', '/spaces/desktop', '/spaces/desktop/delivery',
    '/spaces/desktop/delivery/release', '/spaces/empty',
  ]);
  await writePageEntries(output, routes);
  assert.equal(await fs.readFile(path.join(output, 'spaces/empty/index.html'), 'utf8'), '<div id="root"></div>');
  for (const hidden of ['spaces/hidden', 'spaces/desktop/secret', 'spaces/desktop/delivery/draft']) {
    await assert.rejects(fs.stat(path.join(output, hidden)), { code: 'ENOENT' });
  }
});

test('route collection filters hidden or draft data and rejects routes outside their space', () => {
  const entries = [
    { route: '/spaces/desktop' },
    { route: '/spaces/desktop/visible' },
    { route: '/spaces/desktop/hidden', hidden: true },
    { route: '/spaces/desktop/draft', draft: true },
  ];
  assert.deepEqual(collectPageRoutes([
    { slug: 'desktop', entries },
    { slug: 'hidden', hidden: true, entries: [] },
    { slug: 'draft', draft: true, entries: [] },
  ]), ['/', '/bookmarks', '/search', '/spaces/desktop', '/spaces/desktop/visible']);
  assert.throws(() => collectPageRoutes([{ slug: '../outside', entries: [] }]), /Unsafe page route/);
  assert.throws(() => collectPageRoutes([{ slug: 'desktop', entries: [{ route: '/spaces/elsewhere' }] }]), /outside its space/);
});

test('rejects traversal, encoded separators, file paths, query strings, and hashes', () => {
  for (const route of [
    null, undefined, '', 'spaces/desktop', '//spaces/desktop', '/../escape', '/spaces/../escape',
    '/spaces/desktop/.', '/spaces/desktop//article', '/spaces/desktop/', '/spaces/desktop\\escape',
    '/spaces/desktop/%2e%2e', '/spaces/desktop/%2fescape', '/spaces/desktop/index.html',
    '/search?q=release', '/spaces/desktop#release', '/spaces/desktop/\u0000',
  ]) {
    assert.throws(() => pageOutputPath(route), /page route/);
  }
  assert.equal(pageOutputPath('/'), 'index.html');
  assert.equal(pageOutputPath('/spaces/desktop/release'), path.join('spaces', 'desktop', 'release', 'index.html'));
});

test('validates all routes before writing any generated files', async (t) => {
  const { write, output } = await fixture(t);
  await write('dist/index.html', 'app');
  await assert.rejects(writePageEntries(output, ['/search', '/../escape']), /Unsafe page route/);
  assert.deepEqual(await fs.readdir(output), ['index.html']);
});

test('rejects paths that would collide across case-insensitive or Unicode-normalizing filesystems', async (t) => {
  const { write, output } = await fixture(t);
  await write('dist/index.html', 'app');
  await assert.rejects(writePageEntries(output, ['/spaces/Desktop', '/spaces/desktop']), /Page routes conflict/);
  await assert.rejects(writePageEntries(output, ['/spaces/\u212b', '/spaces/\u00c5']), /Page routes conflict/);
  assert.deepEqual(await fs.readdir(output), ['index.html']);
});

for (const conflictingFile of ['spaces/desktop', 'spaces/desktop/index.html', '404.html', '.nojekyll']) {
  test(`refuses to overwrite existing build output at ${conflictingFile}`, async (t) => {
    const { write, output } = await fixture(t);
    await write('dist/index.html', 'app');
    await write(`dist/${conflictingFile}`, 'existing asset');
    await assert.rejects(writePageEntries(output, ['/search', '/spaces/desktop']), /conflicts with a file|already exists/);
    assert.equal(await fs.readFile(path.join(output, conflictingFile), 'utf8'), 'existing asset');
    await assert.rejects(fs.stat(path.join(output, 'search')), { code: 'ENOENT' });
  });
}

test('refuses symlinked output ancestors without touching external files', async (t) => {
  const { root, write, output } = await fixture(t);
  await write('dist/index.html', 'app');
  await write('outside/index.html', 'outside');
  await fs.symlink(path.join(root, 'outside'), path.join(output, 'spaces'), 'dir');
  await assert.rejects(writePageEntries(output, ['/search', '/spaces/desktop']), /must not follow a symlink/);
  assert.equal(await fs.readFile(path.join(root, 'outside/index.html'), 'utf8'), 'outside');
  await assert.rejects(fs.stat(path.join(root, 'outside/desktop')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(output, 'search')), { code: 'ENOENT' });
});

test('refuses a symlinked source index and a symlinked output directory', async (t) => {
  const { root, write, output } = await fixture(t);
  await write('outside/index.html', 'outside');
  await fs.mkdir(output);
  await fs.symlink(path.join(root, 'outside/index.html'), path.join(output, 'index.html'));
  await assert.rejects(writePageEntries(output, ['/search']), /must not follow a symlink/);
  const linkedOutput = path.join(root, 'linked-output');
  await fs.symlink(path.join(root, 'outside'), linkedOutput, 'dir');
  await assert.rejects(writePageEntries(linkedOutput, ['/search']), /Invalid page output directory/);
});
