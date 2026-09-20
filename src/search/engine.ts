export interface SearchHeading {
  id: string;
  text: string;
  depth: number;
}

export interface SearchDocument {
  route: string;
  spaceSlug: string;
  spaceTitle: string;
  title: string;
  description: string;
  type: string;
  tags: readonly string[];
  directory: readonly string[];
  headings: readonly SearchHeading[];
  text: string;
  updatedAt: string;
}

export interface SearchFilters {
  query: string;
  space: string;
  tag: string;
  type: string;
  sort: 'relevance' | 'updated';
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
  snippet: string;
  heading?: SearchHeading;
  href: string;
}

const normalize = (value: string) => value.normalize('NFKC').toLowerCase();
const termsFor = (query: string) => [...new Set(normalize(query).trim().split(/\s+/u).filter(Boolean))];

// Cache normalized fields so each keystroke does not parse/normalize document sources.
const prepared = new WeakMap<SearchDocument, ReturnType<typeof prepare>>();
function prepare(doc: SearchDocument) {
  return {
    title: normalize(doc.title),
    description: normalize(doc.description),
    tags: doc.tags.map(normalize),
    directory: normalize(doc.directory.join(' ')),
    headings: doc.headings.map((heading) => normalize(heading.text)),
    text: normalize(doc.text),
  };
}

/** Literal matching, with offsets mapped back to the original text for safe React highlights. */
function matchRanges(text: string, terms: readonly string[]) {
  if (!terms.length) return [];
  let normalized = '';
  const offsets: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const character of text) {
    const transformed = normalize(character);
    for (let i = 0; i < transformed.length; i += 1) offsets.push({ start, end: start + character.length });
    normalized += transformed;
    start += character.length;
  }
  const ranges: Array<{ start: number; end: number }> = [];
  for (const term of terms) {
    let from = 0;
    while (from < normalized.length) {
      const index = normalized.indexOf(term, from);
      if (index < 0) break;
      ranges.push({ start: offsets[index].start, end: offsets[index + term.length - 1].end });
      from = index + term.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function highlightText(text: string, query: string): Array<{ text: string; match: boolean }> {
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const range of matchRanges(text, termsFor(query))) {
    if (cursor < range.start) parts.push({ text: text.slice(cursor, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

function excerpt(doc: SearchDocument, terms: readonly string[]) {
  const body = doc.text.replace(/\s+/gu, ' ').trim();
  const description = doc.description.replace(/\s+/gu, ' ').trim();
  // Show the matching passage even when the author's description does not contain the query.
  const text = terms.some((term) => normalize(body).includes(term)) ? body : description || body;
  const matches = matchRanges(text, terms);
  const length = 160;
  let start = 0;
  if (matches.length && text.length > length) {
    let bestCount = -1;
    let left = 0;
    let right = 0;
    for (const match of matches) {
      const candidate = Math.max(0, Math.min(text.length - length, match.start - 36));
      while (left < matches.length && matches[left].start < candidate) left += 1;
      while (right < matches.length && matches[right].end <= candidate + length) right += 1;
      const count = right - left;
      if (count > bestCount) { start = candidate; bestCount = count; }
    }
  }
  return `${start ? '…' : ''}${text.slice(start, start + length)}${start + length < text.length ? '…' : ''}`;
}

export function searchContent(documents: readonly SearchDocument[], filters: SearchFilters): SearchResult[] {
  const terms = termsFor(filters.query);
  const phrase = normalize(filters.query.trim());
  const results: SearchResult[] = [];
  for (const document of documents) {
    if (filters.space && document.spaceSlug !== filters.space) continue;
    if (filters.tag && !document.tags.includes(filters.tag)) continue;
    if (filters.type && document.type !== filters.type) continue;
    let fields = prepared.get(document);
    if (!fields) { fields = prepare(document); prepared.set(document, fields); }
    let score = 0;
    let matchesAll = true;
    for (const term of terms) {
      const weight = fields.title.includes(term) ? 100
        : fields.tags.some((tag) => tag.includes(term)) ? 70
          : fields.headings.some((heading) => heading.includes(term)) ? 50
            : fields.description.includes(term) ? 30
              : fields.directory.includes(term) ? 20
                : fields.text.includes(term) ? 10 : 0;
      if (!weight) { matchesAll = false; break; }
      score += weight;
    }
    if (!matchesAll) continue;
    if (phrase && fields.title === phrase) score += 160;
    else if (phrase && fields.title.includes(phrase)) score += 80;

    // A heading-only match opens that section; title matches open the whole article.
    const heading = terms.length && !terms.every((term) => fields.title.includes(term))
      ? document.headings.find((item, index) => item.depth > 1 && terms.every((term) => fields.headings[index].includes(term)))
      : undefined;
    results.push({ document, score, snippet: excerpt(document, terms), heading,
      href: heading ? `${document.route}#${encodeURIComponent(heading.id)}` : document.route });
  }
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return results.sort((a, b) => {
    const byDate = time(b.document.updatedAt) - time(a.document.updatedAt);
    const byScore = b.score - a.score;
    return (filters.sort === 'updated' ? byDate || byScore : byScore || byDate)
      || a.document.title.localeCompare(b.document.title, 'zh-CN')
      || a.document.route.localeCompare(b.document.route);
  });
}

export function readSearchFilters(search: string): SearchFilters {
  const params = new URLSearchParams(search);
  const space = params.get('space') ?? '';
  return { query: params.get('q') ?? '', space: space === 'all' ? '' : space,
    tag: params.get('tag') ?? '', type: params.get('type') ?? '',
    sort: params.get('sort') === 'updated' ? 'updated' : 'relevance' };
}

export function searchUrl(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.space) params.set('space', filters.space);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.type) params.set('type', filters.type);
  if (filters.sort === 'updated') params.set('sort', filters.sort);
  const query = params.toString();
  return `/search${query ? `?${query}` : ''}`;
}

export function getSearchFacets(documents: readonly SearchDocument[], space: string) {
  const scoped = documents.filter((doc) => !space || doc.spaceSlug === space);
  const spaces = [...new Map(documents.map((doc) => [doc.spaceSlug, { slug: doc.spaceSlug, title: doc.spaceTitle }])).values()];
  const sort = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return { spaces, tags: sort(scoped.flatMap((doc) => [...doc.tags])), types: sort(scoped.map((doc) => doc.type)) };
}
