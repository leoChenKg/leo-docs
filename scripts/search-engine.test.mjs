import test from 'node:test';
import assert from 'node:assert/strict';
import { searchContent, highlightText, readSearchFilters, searchUrl, getSearchFacets } from '../src/search/engine.ts';

const filters = (changes = {}) => ({ query: '', space: '', tag: '', type: '', sort: 'relevance', ...changes });
const doc = (changes = {}) => ({ route: '/spaces/frontend/example', spaceSlug: 'frontend', spaceTitle: '前端工程',
  title: '示例', description: '文章简介', type: 'doc', tags: [], directory: ['基础'],
  headings: [], text: '正文', updatedAt: '2026-09-01', ...changes });

test('ranks title above tags, headings and body; multiple words may match different fields', () => {
  const docs = [doc({ route: '/body', text: 'JavaScript 闭包', updatedAt: '2026-09-30' }),
    doc({ route: '/heading', headings: [{ id: '闭包', text: '闭包', depth: 2 }], text: 'JavaScript' }),
    doc({ route: '/tag', tags: ['闭包'], text: 'JavaScript' }),
    doc({ route: '/title', title: '闭包', tags: ['JavaScript'] })];
  const result = searchContent(docs, filters({ query: '  闭包   JAVASCRIPT  ' }));
  assert.deepEqual(result.map(({ document }) => document.route), ['/title', '/tag', '/heading', '/body']);
  assert.equal(searchContent(docs, filters({ query: '闭包 不存在' })).length, 0);
});

test('section matches open exact encoded heading; title matches stay at page start', () => {
  const section = doc({ headings: [{ id: '闭包的应用场景', text: '闭包的应用场景', depth: 2 }] });
  assert.equal(searchContent([section], filters({ query: '应用场景' }))[0].href,
    `${section.route}#${encodeURIComponent('闭包的应用场景')}`);
  assert.equal(searchContent([{ ...section, title: '闭包的应用场景' }], filters({ query: '应用场景' }))[0].href, section.route);
});

test('snippets show a matching passage beyond the introduction', () => {
  const text = `${'背景知识。'.repeat(80)}保留词法作用域的变量。${'后续解释。'.repeat(60)}`;
  const result = searchContent([doc({ text })], filters({ query: '词法作用域' }))[0];
  assert.ok(result.snippet.includes('词法作用域'));
  assert.ok(result.snippet.startsWith('…'));
  assert.ok(result.snippet.length <= 162);
});

test('space, tag and type are combined and work with an empty query', () => {
  const docs = [doc({ route: '/1', type: 'note', tags: ['函数'] }),
    doc({ route: '/2', tags: ['函数'] }), doc({ route: '/3', spaceSlug: 'math', type: 'note', tags: ['函数'] })];
  assert.deepEqual(searchContent(docs, filters({ space: 'frontend', tag: '函数', type: 'note' })).map(r => r.document.route), ['/1']);
  assert.equal(searchContent(docs, filters({ tag: 'missing' })).length, 0);
  assert.deepEqual(getSearchFacets(docs, 'frontend').tags, ['函数']);
  assert.deepEqual(getSearchFacets(docs, 'frontend').types, ['doc', 'note']);
});

test('updated sort prioritizes dates and default sort prioritizes relevance', () => {
  const docs = [doc({ route: '/new', text: '闭包', updatedAt: '2026-09-19' }),
    doc({ route: '/old', title: '闭包', updatedAt: '2026-09-01' })];
  assert.equal(searchContent(docs, filters({ query: '闭包' }))[0].document.route, '/old');
  assert.equal(searchContent(docs, filters({ query: '闭包', sort: 'updated' }))[0].document.route, '/new');
});

test('highlights literal punctuation and case-insensitive/full-width terms without producing HTML', () => {
  const text = 'ＡＰＩ / API / api [a+b] <img onerror=alert(1)>';
  const parts = highlightText(text, 'api [a+b]');
  assert.equal(parts.map(p => p.text).join(''), text);
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['ＡＰＩ', 'API', 'api', '[a+b]']);
  assert.equal(highlightText(text, '.*').some(p => p.match), false);
  assert.deepEqual(highlightText('闭包的应用场景', '闭包 闭包的'), [
    { text: '闭包的', match: true }, { text: '应用场景', match: false },
  ]);
});

test('query and all filters round-trip in URL including spaces, punctuation and Chinese tags', () => {
  const original = filters({ query: '闭包 API ', space: 'frontend', tag: 'C++ & 函数', type: 'note', sort: 'updated' });
  const url = searchUrl(original);
  assert.deepEqual(readSearchFilters(url.slice(url.indexOf('?'))), original);
  assert.equal(searchUrl(filters()), '/search');
  assert.equal(readSearchFilters('?space=all&sort=invalid').sort, 'relevance');
  assert.equal(readSearchFilters('?space=all').space, '');
});
