import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBasePath, resolveContentHref, stripBasePath, withBasePath } from '../src/site-paths.ts';

const entry = { spaceSlug: 'desktop', relativePath: 'app-delivery/release-process.md' };

test('normalizes root and project deployment bases', () => {
  for (const input of ['', '/', '///']) assert.equal(normalizeBasePath(input), '/');
  for (const input of ['leo-docs', 'leo-docs/', '/leo-docs', '/leo-docs/']) {
    assert.equal(normalizeBasePath(input), '/leo-docs/');
  }
});

test('prefixes root and relative app paths, preserving query strings and fragments', () => {
  for (const base of ['/', '/leo-docs/']) {
    assert.equal(withBasePath('/spaces/desktop/release?mode=1#步骤', base), `${base}spaces/desktop/release?mode=1#步骤`);
    assert.equal(withBasePath('spaces/desktop/release', base), `${base}spaces/desktop/release`);
    assert.equal(withBasePath('./spaces/desktop/release', base), `${base}spaces/desktop/release`);
    assert.equal(withBasePath('/content/中文 图片.svg?v=2#view', base), `${base}content/中文 图片.svg?v=2#view`);
    assert.equal(withBasePath('/', base), base);
    assert.equal(withBasePath('/?query=文档#top', base), `${base}?query=文档#top`);
  }
});

test('does not duplicate an existing base or confuse similar path prefixes', () => {
  for (const path of ['/leo-docs', '/leo-docs/', '/leo-docs/spaces/desktop?q=1#intro']) {
    assert.equal(withBasePath(path, '/leo-docs/'), path);
    assert.equal(withBasePath(withBasePath(path, '/leo-docs/'), '/leo-docs/'), path);
  }
  assert.equal(withBasePath('/leo-docs-extra/file', '/leo-docs/'), '/leo-docs/leo-docs-extra/file');
});

test('leaves external URLs, current-page references and empty values unchanged', () => {
  const values = [undefined, '', '#章节', '?q=文档#章节', 'https://example.com/image.png?q=1', 'HTTP://example.com', '//cdn.example.com/img.png', 'data:image/png;base64,abc', 'blob:https://example.com/id', 'mailto:hello@example.com', 'tel:123'];
  for (const value of values) {
    assert.equal(withBasePath(value, '/leo-docs/'), value);
    assert.equal(resolveContentHref(value, entry, '/leo-docs/', true), value);
    if (typeof value === 'string') assert.equal(stripBasePath(value, '/leo-docs/'), value);
  }
});

test('resolves relative Markdown articles and directory indexes under either base', () => {
  for (const base of ['/', '/leo-docs/']) {
    assert.equal(resolveContentHref('./next.md?from=文档#下一步', entry, base), `${base}spaces/desktop/app-delivery/next?from=文档#下一步`);
    assert.equal(resolveContentHref('../setup/安装.mdx#准备', entry, base), `${base}spaces/desktop/setup/安装#准备`);
    assert.equal(resolveContentHref('./_index.md', entry, base), `${base}spaces/desktop/app-delivery`);
    assert.equal(resolveContentHref('../_index.mdx', entry, base), `${base}spaces/desktop`);
    assert.equal(resolveContentHref('../', entry, base), `${base}spaces/desktop`);
    assert.equal(resolveContentHref('/spaces/desktop/setup#步骤', entry, base), `${base}spaces/desktop/setup#步骤`);
  }
});

test('resolves relative assets and generator-produced root paths under either base', () => {
  for (const base of ['/', '/leo-docs/']) {
    assert.equal(resolveContentHref('../assets/流程.svg?version=2#diagram', entry, base, true), `${base}content/spaces/desktop/assets/流程.svg?version=2#diagram`);
    assert.equal(resolveContentHref('../assets/流程.svg', entry, base), `${base}content/spaces/desktop/assets/流程.svg`);
    assert.equal(resolveContentHref('./demo.mp4', entry, base), `${base}content/spaces/desktop/app-delivery/demo.mp4`);
    assert.equal(resolveContentHref('./poster', entry, base, true), `${base}content/spaces/desktop/app-delivery/poster`);
    assert.equal(resolveContentHref('/content/spaces/desktop/assets/流程.svg', entry, base, true), `${base}content/spaces/desktop/assets/流程.svg`);
    assert.equal(resolveContentHref('/content/shared.png', null, base, true), `${base}content/shared.png`);
  }
  assert.equal(resolveContentHref('/leo-docs/content/diagram.svg', entry, '/leo-docs/', true), '/leo-docs/content/diagram.svg');
  assert.equal(resolveContentHref('/leo-docs/spaces/desktop/release', entry, '/leo-docs/'), '/leo-docs/spaces/desktop/release');
});

test('strips only a matching deployment prefix, preserving internal routes and suffixes', () => {
  assert.equal(stripBasePath('/leo-docs/spaces/桌面端/release?q=1#步骤', '/leo-docs/'), '/spaces/桌面端/release?q=1#步骤');
  assert.equal(stripBasePath('/leo-docs/', '/leo-docs/'), '/');
  assert.equal(stripBasePath('/leo-docs?x=1#top', '/leo-docs/'), '/?x=1#top');
  assert.equal(stripBasePath('/leo-docs-extra/spaces/doc', '/leo-docs/'), '/leo-docs-extra/spaces/doc');
  assert.equal(stripBasePath('/spaces/desktop/release', '/leo-docs/'), '/spaces/desktop/release');
  assert.equal(stripBasePath('/spaces/desktop/release', '/'), '/spaces/desktop/release');
  const route = '/spaces/desktop/release?q=文档#步骤';
  assert.equal(stripBasePath(withBasePath(route, '/leo-docs/'), '/leo-docs/'), route);
});
