import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';

const DEFAULTS = { type: 'doc', draft: false, order: 0, tags: [] };

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

function slugify(value) {
  return value.toLowerCase().replace(/\\/g, '/').replace(/\.mdx?$/i, '')
    .replace(/\/(?:_index|index)$/i, '').replace(/^(?:_index|index)$/i, '')
    .replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '').split('/')
    .map((part) => part.replace(/^\d+[-_]/, '').replace(/[^\p{Letter}\p{Number}_-]+/gu, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean).join('/');
}

function prettyName(value) {
  return value.replace(/^\d+[-_]/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function plainText(source) {
  return source.replace(/```[\s\S]*?```/g, '').replace(/:::\w[^\n]*[\s\S]*?:::/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$]+\$/g, '').replace(/^\s*#{1,6}\s+.+$/gm, '')
    .replace(/<[^>]+>/g, '').replace(/[#$>*_`\[\](){}]/g, '').replace(/\s+/g, ' ').trim();
}

function headings(source) {
  const result = [];
  let fenced = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (!match) continue;
    const text = match[2].trim();
    result.push({ depth: match[1].length, text, id: text.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '') });
  }
  return result;
}

function rewriteMarkdownAssets(body, spaceSlug, filePath, spaceRoot) {
  const fileDir = path.dirname(filePath);
  return body.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (full, before, src, after) => {
    if (/^(https?:|data:|#|\/)/.test(src)) return full;
    if (!before.startsWith('!') && !/\.(?:mp4|webm|ogv|ogg|mp3|wav|m4a|flac)(?:[?#].*)?$/i.test(src)) return full;
    const relative = path.relative(spaceRoot, path.resolve(fileDir, src)).split(path.sep).join('/');
    return `${before}/content/spaces/${spaceSlug}/${relative}${after}`;
  });
}

function isContentFile(filePath, spaceRoot) {
  const parts = path.relative(spaceRoot, filePath).split(path.sep);
  return /\.mdx?$/i.test(filePath) && !parts.includes('assets') && !parts.includes('components');
}

async function copyAssets(spaceRoot, spaceSlug, publicRoot) {
  for (const file of await walk(spaceRoot)) {
    const relative = path.relative(spaceRoot, file);
    if (!relative.split(path.sep).includes('assets')) continue;
    const target = path.join(publicRoot, 'content', 'spaces', spaceSlug, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }
}

function entryRoute(spaceSlug, relative, frontmatterSlug) {
  const routePart = slugify(String(frontmatterSlug ?? relative));
  return `/spaces/${spaceSlug}${routePart ? `/${routePart}` : ''}`;
}

export async function generateContent(root = process.cwd()) {
  const spacesRoot = path.join(root, 'spaces');
  const generatedDir = path.join(root, 'src', 'generated');
  const publicRoot = path.join(root, 'public');
  await fs.mkdir(generatedDir, { recursive: true });
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.rm(path.join(publicRoot, 'content'), { recursive: true, force: true });
  const spaces = [];
  const spaceDirs = (await fs.readdir(spacesRoot, { withFileTypes: true }).catch(() => [])).filter((item) => item.isDirectory());

  for (const dir of spaceDirs) {
    const spaceRoot = path.join(spacesRoot, dir.name);
    const configPath = path.join(spaceRoot, 'space.yml');
    const configSource = await fs.readFile(configPath, 'utf8').catch(() => '');
    if (!configSource) continue;
    const config = yaml.load(configSource);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${configPath} 必须是 YAML 对象`);
    const slug = String(config.slug ?? dir.name).trim();
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Invalid space slug "${slug}" in ${configPath}`);
    if (config.hidden) continue;
    const files = (await walk(spaceRoot)).filter((file) => isContentFile(file, spaceRoot));
    await copyAssets(spaceRoot, slug, publicRoot);
    const entries = [];
    const knownDirectories = new Set(['']);
    for (const file of files) {
      const relative = path.relative(spaceRoot, file).split(path.sep).join('/');
      const source = await fs.readFile(file, 'utf8');
      const parsed = matter(source);
      const data = { ...DEFAULTS, ...parsed.data };
      if (Boolean(data.draft)) continue;
      const dirParts = relative.split('/').slice(0, -1);
      for (let i = 0; i <= dirParts.length; i += 1) knownDirectories.add(dirParts.slice(0, i).join('/'));
      const isIndex = path.basename(relative).startsWith('_index.');
      const route = entryRoute(slug, relative, data.slug);
      const stat = await fs.stat(file);
      entries.push({
        spaceSlug: slug, relativePath: relative, sourcePath: `spaces/${dir.name}/${relative}`, route,
        kind: isIndex ? 'index' : 'doc', title: String(data.title ?? parsed.content.match(/^#\s+(.+)$/m)?.[1] ?? prettyName(path.basename(relative, path.extname(relative)))),
        description: String(data.description ?? plainText(parsed.content).slice(0, 160)), type: String(data.type ?? 'doc'),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [], date: data.date ? String(data.date) : '', order: Number(data.order ?? 0), draft: false,
        dirParts, headings: headings(parsed.content), body: rewriteMarkdownAssets(parsed.content, slug, file, spaceRoot), updatedAt: stat.mtime.toISOString(),
        directoryRoute: `/spaces/${slug}${slugify(dirParts.join('/')) ? `/${slugify(dirParts.join('/'))}` : ''}`,
        parentRoute: `/spaces/${slug}${slugify(dirParts.join('/')) ? `/${slugify(dirParts.join('/'))}` : ''}`,
      });
    }
    const existingDirs = new Set(entries.filter((entry) => entry.kind === 'index').map((entry) => entry.dirParts.join('/')));
    for (const directory of knownDirectories) {
      if (!directory || existingDirs.has(directory)) continue;
      const routePart = slugify(directory);
      entries.push({ spaceSlug: slug, relativePath: '', sourcePath: '', route: `/spaces/${slug}/${routePart}`, kind: 'index', title: prettyName(directory.split('/').at(-1)), description: '', type: 'doc', tags: [], date: '', order: 0, draft: false, dirParts: directory.split('/'), headings: [], body: '', updatedAt: '', directoryRoute: `/spaces/${slug}/${routePart}`, parentRoute: `/spaces/${slug}${slugify(directory.split('/').slice(0, -1).join('/')) ? `/${slugify(directory.split('/').slice(0, -1).join('/'))}` : ''}` });
    }
    const seen = new Set();
    for (const entry of entries) { if (seen.has(entry.route)) throw new Error(`Duplicate route ${entry.route}`); seen.add(entry.route); }
    entries.sort((a, b) => a.order - b.order || a.relativePath.localeCompare(b.relativePath));
    spaces.push({ slug, title: String(config.title ?? dir.name), description: String(config.description ?? ''), icon: String(config.icon ?? 'folder'), order: Number(config.order ?? 0), hidden: false, entries });
  }
  spaces.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const output = `/* generated by scripts/content.mjs */\nexport const spaces = ${JSON.stringify(spaces, null, 2)} as const;\n`;
  const destination = path.join(generatedDir, 'content.ts');
  const previous = await fs.readFile(destination, 'utf8').catch(() => '');
  if (previous !== output) await fs.writeFile(destination, output, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) await generateContent();
