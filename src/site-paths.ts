type ContentLocation = { relativePath: string; spaceSlug: string };

const externalOrCurrentPage = /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i;

export function normalizeBasePath(base: string): string {
  const path = base.replace(/^\/+|\/+$/g, '');
  return path ? `/${path}/` : '/';
}

function splitSuffix(value: string): [string, string] {
  const separator = value.search(/[?#]/);
  return separator === -1 ? [value, ''] : [value.slice(0, separator), value.slice(separator)];
}

/** Convert an app-root path to a browser URL without prefixing it twice. */
export function withBasePath(value: string, base: string): string;
export function withBasePath(value: string | undefined, base: string): string | undefined;
export function withBasePath(value: string | undefined, base: string): string | undefined {
  if (!value || externalOrCurrentPage.test(value)) return value;
  const [pathname, suffix] = splitSuffix(value);
  const path = pathname.startsWith('/') ? pathname : `/${pathname.replace(/^(?:\.\/)+/, '')}`;
  const prefix = normalizeBasePath(base).slice(0, -1);
  if (!prefix || path === prefix || path.startsWith(`${prefix}/`)) return `${path}${suffix}`;
  return `${prefix}${path}${suffix}`;
}

/** Compare browser locations with the deployment-independent content routes. */
export function stripBasePath(value: string, base: string): string {
  if (!value || externalOrCurrentPage.test(value)) return value;
  const [pathname, suffix] = splitSuffix(value);
  const prefix = normalizeBasePath(base).slice(0, -1);
  if (!prefix) return value;
  if (pathname === prefix) return `/${suffix}`;
  if (pathname.startsWith(`${prefix}/`)) return `${pathname.slice(prefix.length)}${suffix}`;
  return value;
}

function normalizeContentPath(value: string) {
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

/** Resolve source-relative article links and assets before adding the site base. */
export function resolveContentHref(href: string | undefined, entry: ContentLocation | null, base: string, asset = false) {
  if (!href || externalOrCurrentPage.test(href)) return href;
  if (!entry || href.startsWith('/')) return withBasePath(href, base);
  const [pathname, suffix] = splitSuffix(href);
  const relativePath = normalizeContentPath(`${entry.relativePath.split('/').slice(0, -1).join('/')}/${pathname}`);
  if (asset || /(?:^|\/)assets\//.test(relativePath) || /\.(?!mdx?(?:$))[^/.]+$/i.test(relativePath)) {
    return withBasePath(`/content/spaces/${entry.spaceSlug}/${relativePath}${suffix}`, base);
  }
  const route = relativePath.replace(/\.mdx?$/i, '').replace(/(?:^|\/)_index$/i, '');
  return withBasePath(`/spaces/${entry.spaceSlug}${route ? `/${route.replace(/\/$/, '')}` : ''}${suffix}`, base);
}
