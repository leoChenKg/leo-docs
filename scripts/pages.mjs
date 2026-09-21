import fs from 'node:fs/promises';
import path from 'node:path';

/** Internal routes deliberately exclude a deployment base, query, and hash. */
export function pageOutputPath(route) {
  if (route === '/') return 'index.html';
  if (typeof route !== 'string' || !route.startsWith('/')) throw new Error(`Invalid page route: ${String(route)}`);
  const parts = route.slice(1).split('/');
  if (parts.some((part) => !/^[\p{Letter}\p{Number}_-]+$/u.test(part))) {
    throw new Error(`Unsafe page route: ${route}`);
  }
  return path.join(...parts, 'index.html');
}

/** The same published content that drives navigation also drives static entries. */
export function collectPageRoutes(spaces) {
  const routes = new Set(['/', '/search', '/bookmarks']);
  for (const space of spaces) {
    if (space.hidden || space.draft) continue;
    const rootRoute = `/spaces/${space.slug}`;
    pageOutputPath(rootRoute);
    routes.add(rootRoute);
    for (const entry of space.entries) {
      if (entry.hidden || entry.draft) continue;
      pageOutputPath(entry.route);
      if (entry.route !== rootRoute && !entry.route.startsWith(`${rootRoute}/`)) {
        throw new Error(`Page route ${entry.route} is outside its space ${rootRoute}`);
      }
      routes.add(entry.route);
    }
  }
  return [...routes].sort();
}

async function statIfPresent(filename) {
  try { return await fs.lstat(filename); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function checkOutputPath(outputRoot, relative, allowExistingFile = false) {
  const target = path.resolve(outputRoot, relative);
  if (!target.startsWith(`${outputRoot}${path.sep}`)) throw new Error(`Page output escapes its directory: ${relative}`);
  let current = outputRoot;
  const parts = relative.split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stat = await statIfPresent(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new Error(`Page output must not follow a symlink: ${current}`);
    const isTarget = index === parts.length - 1;
    if (!isTarget && !stat.isDirectory()) throw new Error(`Page output conflicts with a file: ${current}`);
    if (isTarget && (!allowExistingFile || !stat.isFile())) {
      throw new Error(`Page output already exists: ${current}`);
    }
  }
  return target;
}

/** Copy the completed Vite shell; its script/style URLs already contain Vite's base. */
export async function writePageEntries(outputDirectory, routes) {
  const outputRoot = path.resolve(outputDirectory);
  const rootStat = await fs.lstat(outputRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Invalid page output directory: ${outputRoot}`);
  const indexPath = await checkOutputPath(outputRoot, 'index.html', true);
  const html = await fs.readFile(indexPath, 'utf8');
  const outputs = new Map();
  const portablePaths = new Map();
  for (const route of new Set(routes)) {
    const relative = pageOutputPath(route);
    const portablePath = relative.normalize('NFC').toLowerCase();
    const previous = portablePaths.get(portablePath);
    if (previous && previous !== route) throw new Error(`Page routes conflict: ${previous} and ${route}`);
    portablePaths.set(portablePath, route);
    if (route !== '/') outputs.set(relative, html);
  }
  outputs.set('404.html', html);
  outputs.set('.nojekyll', '');

  // Validate the entire plan before writing, so conflicts do not leave a partial export.
  for (const relative of outputs.keys()) await checkOutputPath(outputRoot, relative);
  for (const [relative, contents] of outputs) {
    const target = path.join(outputRoot, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, { encoding: 'utf8', flag: 'wx' });
  }
  return [...outputs.keys()];
}
