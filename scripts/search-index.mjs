import GithubSlugger from 'github-slugger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';

const markdownParser = unified().use(remarkParse).use(remarkFrontmatter, ['yaml', 'toml']).use(remarkGfm).use(remarkMath);
const mdxParser = markdownParser().use(remarkMdx);
const ignoredNodes = new Set(['yaml', 'toml', 'mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression', 'definition', 'footnoteDefinition']);
const inlineNodes = new Set(['text', 'inlineCode', 'inlineMath', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'mdxJsxTextElement']);

// These blocks are rendered by ContentRenderer rather than a remark plugin.
// Keep their visible title/body, without indexing their control syntax.
function normalizeContentBlocks(source) {
  let fence;
  return source.split(/\r?\n/).map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return line;
    }
    if (fence) return line;
    if (/^:::\s*$/.test(line)) return '';
    const alert = line.match(/^:::(?:info|success|warning|error|tip)(?:\s+(.+))?\s*$/i);
    if (alert) return alert[1] ? `${alert[1]}\n` : '';
    const chart = line.match(/^:::chart(?:\s+(?:bar|line))?(?:\s+(.+))?\s*$/i);
    if (chart) return chart[1] ? `${chart[1]}\n` : '';
    return line;
  }).join('\n');
}

function visibleText(node) {
  if (ignoredNodes.has(node.type)) return '';
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
  if (['text', 'code', 'inlineCode', 'math', 'inlineMath'].includes(node.type)) return node.value ?? '';
  if (node.type === 'break') return '\n';
  // ReactMarkdown does not render raw HTML. MDX elements are handled through
  // their children below; component attributes and expressions stay excluded.
  if (node.type === 'html') return '';
  if (!node.children) return '';
  return node.children.map((child, index) => {
    const value = visibleText(child);
    if (!value || index === node.children.length - 1 || inlineNodes.has(child.type)) return value;
    return `${value}\n`;
  }).join('');
}

// Link destinations are omitted by the AST walker while link labels remain.
// Do not strip URL-looking code: code blocks are intentionally searchable.
const normalizeText = (text) => text.replace(/\s+/gu, ' ').trim();

/** Parse content without evaluating MDX or importing its components. */
export function extractSearchContent(source, { mdx = false } = {}) {
  const tree = (mdx ? mdxParser : markdownParser).parse(normalizeContentBlocks(source));
  const slugger = new GithubSlugger();
  const headings = [];
  function visit(node) {
    if (ignoredNodes.has(node.type)) return;
    if (node.type === 'heading') {
      const text = normalizeText(visibleText(node));
      headings.push({ id: slugger.slug(text), text, depth: node.depth });
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(tree);
  return { text: normalizeText(visibleText(tree)), headings };
}

/** Stable, serializable search data; all fields are plain text or metadata. */
export function buildSearchDocuments(spaces) {
  const documents = [];
  for (const space of spaces) {
    if (space.hidden || space.draft) continue;
    const directories = new Map(space.entries.filter((entry) => entry.kind === 'index')
      .map((entry) => [entry.dirParts.join('/'), entry.title]));
    for (const entry of space.entries) {
      if (entry.draft || entry.hidden || !entry.sourcePath) continue;
      const parsed = extractSearchContent(entry.body, { mdx: /\.mdx$/i.test(entry.sourcePath) });
      const ancestorParts = entry.kind === 'index' ? entry.dirParts.slice(0, -1) : entry.dirParts;
      const directory = ancestorParts.map((_, index) => directories.get(ancestorParts.slice(0, index + 1).join('/')))
        .filter((title) => title !== undefined);
      documents.push({
        route: entry.route,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        title: entry.title,
        description: entry.description,
        type: entry.type,
        tags: [...entry.tags],
        directory,
        headings: parsed.headings,
        text: parsed.text,
        updatedAt: entry.updatedAt,
      });
    }
  }
  return documents.sort((a, b) => a.route < b.route ? -1 : a.route > b.route ? 1 : 0);
}
