import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractSearchContent, buildSearchDocuments } from './search-index.mjs';
import { generateContent } from './content.mjs';

test('extracts Chinese, English, code, math, links and callouts without Markdown syntax', () => {
  const source = `---
title: FRONTMATTER_SECRET
---
# JavaScript 闭包

## **词法**作用域与 \`scope\`

闭包可以记住状态，read more in [函数参考](https://example.com/URL_SECRET)。

:::info 关键点
提示框里的中文说明。
:::

![闭包示意图](./assets/IMAGE_SECRET.svg)

| 方法 | 结果 |
| --- | --- |
| counter | 递增 |

行内公式 $x + y$。

\`\`\`javascript
function createCounter() { return count + 1; }
// :::warning should remain in a code block
\`\`\`

## **词法**作用域与 \`scope\`

末尾文字。
`;
  const result = extractSearchContent(source);
  for (const phrase of ['JavaScript 闭包', '词法作用域与 scope', '函数参考', '关键点', '提示框里的中文说明', '闭包示意图', 'counter', '递增', 'x + y', 'function createCounter() { return count + 1; }', '// :::warning']) {
    assert.ok(result.text.includes(phrase), `Missing searchable text: ${phrase}`);
  }
  for (const excluded of ['FRONTMATTER_SECRET', 'URL_SECRET', 'IMAGE_SECRET', ':::info', '```']) assert.ok(!result.text.includes(excluded));
  assert.deepEqual(result.headings, [
    { id: 'javascript-闭包', text: 'JavaScript 闭包', depth: 1 },
    { id: '词法作用域与-scope', text: '词法作用域与 scope', depth: 2 },
    { id: '词法作用域与-scope-1', text: '词法作用域与 scope', depth: 2 },
  ]);
});

test('MDX indexes visible component content and never executes imports or expressions', () => {
  const source = `import Demo from './DO_NOT_IMPORT.js'
export const secret = 'EXPORT_SECRET'

## 组件 **Alert**

<Alert severity="PROP_SECRET"><AlertTitle>警告标题</AlertTitle>这是可以搜索的提示正文。</Alert>

<Demo name="DEMO_PROP_SECRET" />

{(() => { throw new Error('EXPRESSION_SECRET'); })()}

普通段落的 \`inlineCode\`。
`;
  const result = extractSearchContent(source, { mdx: true });
  assert.ok(result.text.includes('警告标题'));
  assert.ok(result.text.includes('这是可以搜索的提示正文'));
  assert.ok(result.text.includes('inlineCode'));
  for (const excluded of ['DO_NOT_IMPORT', 'EXPORT_SECRET', 'PROP_SECRET', 'DEMO_PROP_SECRET', 'EXPRESSION_SECRET', 'severity=']) assert.ok(!result.text.includes(excluded));
  assert.deepEqual(result.headings, [{ id: '组件-alert', text: '组件 Alert', depth: 2 }]);
});

test('supports setext and h5/h6 headings while fenced pseudo-headings stay out', () => {
  const result = extractSearchContent('介绍\n====\n\n##### 第五级\n\n###### 第六级\n\n~~~txt\n## 代码示例不是标题\n~~~');
  assert.deepEqual(result.headings.map(({ text, depth }) => ({ text, depth })), [
    { text: '介绍', depth: 1 }, { text: '第五级', depth: 5 }, { text: '第六级', depth: 6 },
  ]);
  assert.ok(result.text.includes('代码示例不是标题'));
});

test('excludes draft/hidden spaces and entries plus automatic directory pages', () => {
  const entry = { route: '/spaces/front/visible', sourcePath: 'spaces/front/visible.md', kind: 'doc', title: 'Visible', description: '', type: 'doc', tags: [], dirParts: [], body: '正文', updatedAt: '2026-09-19' };
  const space = { slug: 'front', title: '前端', entries: [entry, { ...entry, route: '/draft', draft: true }, { ...entry, route: '/hidden', hidden: true }, { ...entry, route: '/auto', kind: 'index', sourcePath: '', body: '' }] };
  assert.deepEqual(buildSearchDocuments([space]).map(({ route }) => route), ['/spaces/front/visible']);
  assert.deepEqual(buildSearchDocuments([{ ...space, hidden: true }, { ...space, draft: true }]), []);
});

async function readGenerated(root, name, exportedName) {
  const source = await fs.readFile(path.join(root, 'src', 'generated', name), 'utf8');
  return JSON.parse(source.slice(source.indexOf(`export const ${exportedName} = `) + `export const ${exportedName} = `.length).replace(/ as const;\s*$/, ''));
}

test('generation writes deterministic search data, display breadcrumbs, and refreshes after edits/deletes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'leo-search-index-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  async function write(relative, source) {
    const filename = path.join(root, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, source, 'utf8');
  }
  await write('spaces/frontend/space.yml', 'slug: frontend\ntitle: 前端工程');
  await write('spaces/frontend/_index.md', '---\ntitle: 空间首页\n---\n首页内容');
  await write('spaces/frontend/basics/_index.md', '---\ntitle: 基础语法\n---\n基础目录说明');
  await write('spaces/frontend/basics/deep/_index.md', '---\ntitle: 深入理解\n---\n深入目录说明');
  await write('spaces/frontend/basics/deep/closure.mdx', '---\ntitle: 闭包\ntype: note\ntags: [JavaScript, 函数]\n---\n## 使用示例\n\n<Alert severity="info">记住词法环境</Alert>');
  await write('spaces/frontend/automatic/visible.md', '---\ntitle: 自动目录文档\n---\n可见内容');
  await write('spaces/frontend/draft.md', '---\ndraft: true\n---\n草稿私密正文');
  await write('spaces/frontend/hidden.md', '---\nhidden: true\n---\n隐藏私密正文');
  await write('spaces/hidden/space.yml', 'slug: hidden\ntitle: 隐藏空间\nhidden: true');
  await write('spaces/hidden/document.md', '不应被搜索');

  await generateContent(root);
  const documents = await readGenerated(root, 'search.ts', 'searchDocuments');
  const routes = documents.map(({ route }) => route);
  assert.deepEqual(routes, ['/spaces/frontend', '/spaces/frontend/automatic/visible', '/spaces/frontend/basics', '/spaces/frontend/basics/deep', '/spaces/frontend/basics/deep/closure']);
  const closure = documents.find(({ title }) => title === '闭包');
  assert.deepEqual(closure.directory, ['基础语法', '深入理解']);
  assert.deepEqual(closure.tags, ['JavaScript', '函数']);
  assert.equal(closure.spaceTitle, '前端工程');
  assert.equal(closure.type, 'note');
  assert.equal(closure.text, '使用示例 记住词法环境');
  assert.deepEqual(closure.headings, [{ id: '使用示例', text: '使用示例', depth: 2 }]);
  assert.ok(!Number.isNaN(Date.parse(closure.updatedAt)));
  assert.deepEqual(documents.find(({ title }) => title === '深入理解').directory, ['基础语法']);
  assert.deepEqual(documents.find(({ title }) => title === '自动目录文档').directory, ['Automatic']);
  const spaces = await readGenerated(root, 'content.ts', 'spaces');
  assert.equal(spaces.length, 1);
  assert.ok(!spaces[0].entries.some(({ route }) => /\/(?:draft|hidden)$/.test(route)));
  assert.deepEqual(spaces[0].entries.find(({ title }) => title === '闭包').headings, closure.headings);

  const generatedPath = path.join(root, 'src', 'generated', 'search.ts');
  const first = await fs.readFile(generatedPath, 'utf8');
  const firstStat = await fs.stat(generatedPath);
  await generateContent(root);
  assert.equal(await fs.readFile(generatedPath, 'utf8'), first);
  assert.equal((await fs.stat(generatedPath)).mtimeMs, firstStat.mtimeMs, 'unchanged index should not be rewritten');

  await write('spaces/frontend/basics/deep/closure.mdx', '---\ntitle: 闭包已更新\n---\n## 新标题\n\n新正文');
  await fs.rm(path.join(root, 'spaces/frontend/automatic/visible.md'));
  await generateContent(root);
  const refreshed = await readGenerated(root, 'search.ts', 'searchDocuments');
  assert.ok(refreshed.some(({ title, text }) => title === '闭包已更新' && text.includes('新正文')));
  assert.ok(!refreshed.some(({ route }) => route === '/spaces/frontend/automatic/visible'));
});
