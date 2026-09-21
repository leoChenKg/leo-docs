import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppBar,
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Collapse,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArticleOutlined,
  ArrowBack,
  ArrowForward,
  DarkModeOutlined,
  FolderRounded,
  HomeRounded,
  KeyboardArrowDownRounded,
  KeyboardArrowRightRounded,
  LightModeOutlined,
  MenuBookOutlined,
  MenuRounded,
  LocalOfferRounded,
  SearchRounded,
  SearchOff,
  CloseRounded,
  UpdateRounded,
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { spaces } from './generated/content';
import type { ContentEntry, Space } from './types';
import { searchUrl } from './search';
import { stripBasePath } from './site-paths';
import { ContentRenderer } from './components/ContentRenderer';
import { OnThisPage } from './components/OnThisPage';
import { ResizeDivider } from './components/ResizeDivider';
import { BackToTop } from './components/BackToTop';
import { usePanelWidths } from './layout/usePanelWidths';
import { SearchDialog, SearchPage } from './components/Search';
import { BookmarkButton, BookmarksLink, BookmarksPage } from './components/Bookmarks';
import { findReadingMemory } from './reading-memory/model';
import { useReadingMemory } from './reading-memory/store';
import { createDocsTheme } from './theme';
import './styles.css';

type ColorMode = 'light' | 'dark' | 'system';
type Breadcrumb = { title: string; route?: string };

type Directory = {
  name: string;
  route: string;
  index?: ContentEntry;
  docs: ContentEntry[];
  children: Map<string, Directory>;
};

const appBarHeight = 64;
// Keep the fixed app bar and the navigation drawer below the device safe area.
// `env(...)` resolves to 0 on desktop, so this does not change the desktop layout.
const appBarOffset = `calc(${appBarHeight}px + env(safe-area-inset-top))`;
const asSpaces = spaces as unknown as Space[];

function visibleSpaces() {
  return asSpaces.filter((space) => !space.hidden);
}

function currentSpaceFor(pathname: string) {
  const slug = pathname.match(/^\/spaces\/([^/]+)/)?.[1];
  return visibleSpaces().find((space) => space.slug === slug);
}

function cleanTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '');
  return pathname;
}

function entryForPath(space: Space | undefined, pathname: string) {
  return space?.entries.find((entry) => entry.route === pathname && !entry.draft);
}

function prettySegment(value: string) {
  return value.replace(/^\d+[-_]/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replaceAll('/', '-');
}

function directoryRouteFor(space: Space, parts: readonly string[]) {
  const key = parts.join('/');
  const index = space.entries.find((entry) => entry.kind === 'index' && entry.dirParts.join('/') === key);
  if (index) return index.route;
  const routeParts = parts.map((part) => part.toLowerCase().replace(/^\d+[-_]/, '').replace(/[^\p{Letter}\p{Number}_-]+/gu, '-').replace(/^-+|-+$/g, '')).filter(Boolean);
  return `/spaces/${space.slug}/${routeParts.join('/')}`;
}

function buildDirectoryTree(space: Space): Directory {
  const root: Directory = { name: space.title, route: `/spaces/${space.slug}`, docs: [], children: new Map() };
  for (const entry of space.entries.filter((item) => !item.draft)) {
    if (entry.kind === 'index' && entry.route === root.route) {
      root.index = entry;
      continue;
    }
    const parts = [...entry.dirParts];
    let node = root;
    parts.forEach((part, index) => {
      const route = directoryRouteFor(space, parts.slice(0, index + 1));
      if (!node.children.has(part)) node.children.set(part, { name: part, route, docs: [], children: new Map() });
      node = node.children.get(part)!;
    });
    if (entry.kind === 'index') node.index = entry;
    else node.docs.push(entry);
  }
  return root;
}

function sortedDocs(directory: Directory) {
  return [...directory.docs].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
}

function directoryHasItems(directory: Directory) {
  return directory.children.size > 0 || directory.docs.length > 0;
}

function directoryId(route: string) {
  return `directory-${route.replace(/[^a-z\d_-]+/gi, '-')}`;
}

const navigationItemSx = {
  minHeight: 44, width: '100%', px: 1.25, borderRadius: 1,
  textAlign: 'left', color: 'text.secondary',
  transition: 'background-color 150ms ease, color 150ms ease',
  '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: 'inherit' },
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  '&.Mui-selected, &.Mui-selected:hover': {
    color: 'primary.main', bgcolor: 'action.selected',
    borderLeft: '3px solid', borderLeftColor: 'primary.main', pl: 'calc(10px - 3px)',
    '& .MuiListItemText-primary': { fontWeight: 700 },
  },
};

function NavigationTree({ directory, activePath, close, expanded, toggle }: { directory: Directory; activePath: string; close: () => void; expanded: Set<string>; toggle: (route: string) => void }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const children = [...directory.children.values()].sort((a, b) => {
    const orderA = a.index?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.index?.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.name.localeCompare(b.name, 'zh-CN');
  });
  return (
    <List disablePadding>
      {children.map((child) => {
        const title = child.index?.title ?? prettySegment(child.name);
        const hasItems = directoryHasItems(child);
        const open = expanded.has(child.route);
        return <Box component="li" key={child.route} sx={{ listStyle: 'none' }}>
          <ListItemButton
            component={Link}
            to={child.route}
            selected={activePath === child.route}
            aria-current={activePath === child.route ? 'page' : undefined}
            aria-expanded={hasItems ? open : undefined}
            aria-controls={hasItems ? directoryId(child.route) : undefined}
            title={title}
            onClick={() => { if (hasItems) toggle(child.route); close(); }}
            onKeyDown={(event) => {
              if (hasItems && ((event.key === 'ArrowRight' && !open) || (event.key === 'ArrowLeft' && open))) {
                event.preventDefault(); toggle(child.route);
              }
            }}
            sx={{ ...navigationItemSx, minWidth: 0 }}
          >
            <ListItemIcon sx={{ minWidth: 26 }}><FolderRounded sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary={title} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
            {hasItems && <KeyboardArrowRightRounded sx={{ flexShrink: 0, ml: 0.5, fontSize: 20, color: open ? 'primary.main' : 'text.secondary', transform: open ? 'rotate(90deg)' : 'none', transition: reduceMotion ? 'none' : 'transform 220ms ease' }} />}
          </ListItemButton>
          {hasItems && <Collapse in={open} timeout={reduceMotion ? 0 : 220} unmountOnExit>
            <Box id={directoryId(child.route)} sx={{ pl: 2 }}><NavigationTree directory={child} activePath={activePath} close={close} expanded={expanded} toggle={toggle} /></Box>
          </Collapse>}
        </Box>;
      })}
      {sortedDocs(directory).map((entry) => (
        <Box component="li" key={entry.route} sx={{ listStyle: 'none' }}>
          <ListItemButton component={Link} to={entry.route} title={entry.title} selected={activePath === entry.route} aria-current={activePath === entry.route ? 'page' : undefined} onClick={close} sx={navigationItemSx}>
            <ListItemIcon sx={{ minWidth: 26 }}><ArticleOutlined sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary={entry.title} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
          </ListItemButton>
        </Box>
      ))}
    </List>
  );
}

function SpaceNavigation({ space, activePath, close, temporary }: { space: Space; activePath: string; close: () => void; temporary: boolean }) {
  const tree = useMemo(() => buildDirectoryTree(space), [space]);
  const routeAncestors = useMemo(() => {
    const routes = new Set<string>();
    const pathParts = activePath.split('/');
    for (let index = 1; index <= pathParts.length; index += 1) {
      const route = pathParts.slice(0, index).join('/');
      if (route.startsWith(`/spaces/${space.slug}/`)) routes.add(route);
    }
    return routes;
  }, [activePath, space.slug]);
  const initialExpanded = useMemo(() => new Set(routeAncestors), [routeAncestors]);
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const lastActivePath = useRef(activePath);
  const pendingToggle = useRef<{ route: string; open: boolean } | null>(null);
  useEffect(() => {
    if (lastActivePath.current === activePath) return;
    lastActivePath.current = activePath;
    const intent = pendingToggle.current;
    pendingToggle.current = null;
    setExpanded((current) => {
      const next = new Set([...current, ...routeAncestors]);
      // Navigating to a directory overview changes the active path. Preserve
      // an explicit collapse instead of immediately re-expanding its ancestors.
      if (intent && !intent.open) next.delete(intent.route);
      return next;
    });
  }, [activePath, routeAncestors]);
  const toggle = (route: string) => {
    const open = !expanded.has(route);
    pendingToggle.current = { route, open };
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(route); else next.delete(route);
      return next;
    });
  };
  return (
    <Box component="nav" aria-label={`${space.title} 文档导航`} sx={{ px: 2, py: 2 }}>
      {temporary && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}><IconButton aria-label="关闭导航" onClick={close} sx={{ minWidth: 44, minHeight: 44 }}><CloseRounded /></IconButton></Box>}
      <ListItemButton component={Link} to={`/spaces/${space.slug}`} selected={activePath === `/spaces/${space.slug}`} aria-current={activePath === `/spaces/${space.slug}` ? 'page' : undefined} onClick={close} sx={{ ...navigationItemSx, mb: 2 }}>
        <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}><HomeRounded sx={{ fontSize: 19 }} /></ListItemIcon>
        <ListItemText primary="概览" primaryTypographyProps={{ fontWeight: 650 }} />
      </ListItemButton>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.25, letterSpacing: 1.1, display: 'block', mb: 1, fontSize: 11 }}>文档目录</Typography>
      <NavigationTree directory={tree} activePath={activePath} close={close} expanded={expanded} toggle={toggle} />
    </Box>
  );
}

function normalizeBreadcrumbs(entry: ContentEntry, space: Space): Breadcrumb[] {
  const fromEntry = (entry as ContentEntry & { breadcrumbs?: Breadcrumb[] }).breadcrumbs;
  if (Array.isArray(fromEntry) && fromEntry.length > 0) return [{ title: space.title, route: `/spaces/${space.slug}` }, ...fromEntry];
  const directories = entry.dirParts.map((part, index) => {
    const parts = entry.dirParts.slice(0, index + 1);
    const directory = space.entries.find((candidate) => candidate.kind === 'index' && candidate.dirParts.join('/') === parts.join('/'));
    return { title: directory?.title ?? prettySegment(part), route: directory?.route ?? directoryRouteFor(space, parts) };
  });
  return [{ title: space.title, route: `/spaces/${space.slug}` }, ...directories];
}

function EntryBreadcrumbs({ entry, space }: { entry: ContentEntry; space: Space }) {
  const crumbs = normalizeBreadcrumbs(entry, space);
  return (
    <Breadcrumbs aria-label="面包屑导航" sx={{ mb: { xs: 1.5, sm: 2 }, maxWidth: '100%', overflowWrap: 'anywhere', '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap', rowGap: 0.25 } }}>
      {crumbs.map((crumb) => crumb.route && crumb.route !== entry.route ? <MuiLink component={Link} to={crumb.route} underline="hover" color="inherit" key={`${crumb.route}-${crumb.title}`}>{crumb.title}</MuiLink> : <Typography color="text.primary" aria-current="page" key={crumb.title}>{crumb.title}</Typography>)}
    </Breadcrumbs>
  );
}

function withoutPageTitle(entry: ContentEntry) {
  const body = entry.body ?? '';
  const match = body.match(/^\s*#\s+([^\n]+)\s*\n/);
  return match && match[1].trim() === entry.title.trim() ? body.slice(match[0].length) : body;
}

function DirectoryCards({ space, directoryRoute, currentEntry }: { space: Space; directoryRoute: string; currentEntry?: ContentEntry }) {
  const children = space.entries.filter((entry) => !entry.draft && entry.route !== currentEntry?.route && (entry.directoryRoute === directoryRoute || (entry.kind === 'index' && entry.parentRoute === directoryRoute)));
  const unique = [...new Map(children.map((entry) => [entry.route, entry])).values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
  if (!unique.length) return null;
  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>本目录</Typography>
      <Stack spacing={1.25}>
        {unique.map((entry) => <Card variant="outlined" key={entry.route}><CardActionArea component={Link} to={entry.route} sx={{ minHeight: 64 }}><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}><Typography variant="subtitle1" fontWeight={650} sx={{ overflowWrap: 'anywhere' }}>{entry.title}</Typography>{entry.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{entry.description}</Typography>}</CardContent></CardActionArea></Card>)}
      </Stack>
    </Box>
  );
}

function PrevNext({ space, entry }: { space: Space; entry: ContentEntry }) {
  const directoryRoute = entry.directoryRoute ?? entry.parentRoute ?? `/spaces/${space.slug}`;
  const entries = space.entries.filter((item) => !item.draft && item.kind !== 'index' && (item.directoryRoute ?? item.parentRoute) === directoryRoute).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
  const position = entries.findIndex((item) => item.route === entry.route);
  const previous = position > 0 ? entries[position - 1] : undefined;
  const next = position >= 0 && position < entries.length - 1 ? entries[position + 1] : undefined;
  if (!previous && !next) return null;
  return <Box component="nav" aria-label="相邻文章" sx={{ mt: 'auto', pt: 6, borderTop: 1, borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
    {previous && <Button component={Link} to={previous.route} startIcon={<ArrowBack />} sx={{ textAlign: 'left', justifyContent: 'flex-start', minHeight: 52, minWidth: 0 }}><Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Typography variant="caption" display="block" color="text.secondary">上一篇</Typography><Typography variant="body2">{previous.title}</Typography></Box></Button>}
    {next && <Button component={Link} to={next.route} endIcon={<ArrowForward />} sx={{ gridColumn: { sm: 2 }, textAlign: 'right', justifyContent: 'flex-end', minHeight: 52, minWidth: 0 }}><Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Typography variant="caption" display="block" color="text.secondary">下一篇</Typography><Typography variant="body2">{next.title}</Typography></Box></Button>}
  </Box>;
}

function DocPage({ entry, space }: { entry: ContentEntry; space: Space }) {
  const isDirectoryIndex = entry.kind === 'index';
  const directoryRoute = entry.directoryRoute ?? entry.route;
  const tags = (entry.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const updatedAt = entry.updatedAt || entry.date;
  return <>
    <EntryBreadcrumbs entry={entry} space={space} />
    <Typography component="h1" variant="h3" tabIndex={-1} sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: '2.125rem', sm: '2.75rem' }, lineHeight: { xs: 1.2, sm: 1.15 }, overflowWrap: 'anywhere' }}>{entry.title}</Typography>
    {entry.description && <Typography variant="h6" component="p" color="text.secondary" sx={{ mt: { xs: 0.75, sm: 1 }, fontSize: { xs: '1.125rem', sm: '1.25rem' }, lineHeight: 1.6, fontWeight: 400, overflowWrap: 'anywhere' }}>{entry.description}</Typography>}
    {(tags.length > 0 || Boolean(updatedAt) || Boolean(entry.sourcePath)) && <Box aria-label="文章信息" sx={{ mt: { xs: 2, sm: 2.5 }, mb: { xs: 2.5, sm: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 2 }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        {tags.length > 0 && <Stack direction="row" spacing={0.9} useFlexGap flexWrap="wrap" alignItems="center" sx={{ minWidth: 0 }}>
          <LocalOfferRounded color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />
          {tags.map((tag, index) => <Stack direction="row" spacing={0.9} alignItems="center" key={tag}>
            {index > 0 && <Typography color="text.disabled" aria-hidden="true">·</Typography>}
            <MuiLink component={Link} to={searchUrl({ query: '', space: '', tag, type: '', sort: 'relevance' })} underline="hover" color="primary" variant="body2" fontWeight={650}>{tag}</MuiLink>
          </Stack>)}
        </Stack>}
        <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
        <BookmarkButton entry={entry} space={space} />
      </Stack>
      {updatedAt && <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.5, color: 'text.secondary' }}>
        <UpdateRounded sx={{ fontSize: 18 }} />
        <Typography variant="caption">最后更新于 {formatDate(updatedAt)}</Typography>
      </Stack>}
    </Box>}
    <Divider sx={{ mb: { xs: 2.5, sm: 3 } }} />
    {entry.body ? <ContentRenderer entry={{ ...entry, body: withoutPageTitle(entry) }} /> : entry.kind === 'index' ? <Alert severity="info" icon={<ArticleOutlined />} sx={{ mt: 1 }}>
      这个目录目前还没有说明文档。可以在 <Box component="code" sx={{ fontFamily: 'monospace' }}>{entry.dirParts.length ? `spaces/${space.slug}/${entry.dirParts.join('/')}/_index.md` : `spaces/${space.slug}/_index.md`}</Box> 创建或编辑目录总览，作为该模块的统一说明。
    </Alert> : <Typography color="text.secondary">这个目录还没有说明文档。</Typography>}
    {isDirectoryIndex && <DirectoryCards space={space} directoryRoute={directoryRoute} currentEntry={entry} />}
    <PrevNext space={space} entry={entry} />
  </>;
}

function SpaceHome({ space }: { space: Space }) {
  const index = space.entries.find((entry) => entry.kind === 'index' && entry.route === `/spaces/${space.slug}`);
  const docs = space.entries.filter((entry) => !entry.draft && entry.kind !== 'index').sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || '')).slice(0, 8);
  return <>
    <Breadcrumbs sx={{ mb: { xs: 1.5, sm: 2 }, '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' } }}><Typography color="text.secondary">文档空间</Typography><Typography color="text.primary" sx={{ overflowWrap: 'anywhere' }}>{space.title}</Typography></Breadcrumbs>
    <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} alignItems="center"><MenuBookOutlined color="primary" sx={{ fontSize: { xs: 28, sm: 32 }, flexShrink: 0 }} /><Typography component="h1" variant="h3" tabIndex={-1} sx={{ fontWeight: 800, fontSize: { xs: '2.125rem', sm: '2.75rem' }, lineHeight: { xs: 1.2, sm: 1.15 }, overflowWrap: 'anywhere' }}>{space.title}</Typography></Stack>
    {space.description && <Typography variant="h6" component="p" color="text.secondary" sx={{ mt: { xs: 0.75, sm: 1 }, fontSize: { xs: '1.125rem', sm: '1.25rem' }, lineHeight: 1.6, fontWeight: 400, overflowWrap: 'anywhere' }}>{space.description}</Typography>}
    {index?.body && <><Divider sx={{ my: { xs: 3, sm: 4 } }} /><ContentRenderer entry={{ ...index, body: withoutPageTitle(index) }} /></>}
    <Typography variant="h5" component="h2" sx={{ mt: { xs: 4, sm: 5 }, mb: 2, fontWeight: 700, fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>最近文档</Typography>
    <Stack spacing={1.25}>{docs.map((entry) => <Card variant="outlined" key={entry.route}><CardActionArea component={Link} to={entry.route} sx={{ minHeight: 76 }}><CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={{ xs: 0.5, sm: 2 }}><Typography variant="h6" component="h3" fontWeight={650} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{entry.title}</Typography>{(entry.updatedAt || entry.date) && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.updatedAt || entry.date)}</Typography>}</Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{entry.description}</Typography></CardContent></CardActionArea></Card>)}{docs.length === 0 && <Typography color="text.secondary">这个空间还没有文档。</Typography>}</Stack>
  </>;
}

function SpacesHome() {
  return <>
    <Typography component="h1" variant="h3" sx={{ fontWeight: 800, fontSize: { xs: '2.125rem', sm: '2.75rem' }, lineHeight: { xs: 1.2, sm: 1.15 }, overflowWrap: 'anywhere' }}>学习文档空间</Typography>
    <Typography variant="h6" component="p" color="text.secondary" sx={{ mt: { xs: 0.75, sm: 1 }, mb: { xs: 3, sm: 4 }, fontSize: { xs: '1.125rem', sm: '1.25rem' }, lineHeight: 1.6, fontWeight: 400 }}>从一个空间开始阅读、整理和沉淀。</Typography>
    {visibleSpaces().length === 0 ? <Box sx={{ py: 8, textAlign: 'center' }}><SearchOff color="disabled" sx={{ fontSize: 48 }} /><Typography sx={{ mt: 1 }} color="text.secondary">还没有可展示的文档空间。</Typography></Box> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>{visibleSpaces().map((space) => { const docs = space.entries.filter((entry) => !entry.draft && entry.kind !== 'index'); const recent = docs.slice().sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''))[0]; return <Card variant="outlined" key={space.slug}><CardActionArea component={Link} to={`/spaces/${space.slug}`} sx={{ height: '100%', minHeight: 150, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' }}><CardContent sx={{ p: 2.5, width: '100%', height: '100%' }}><Box sx={{ minWidth: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}><Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}><MenuBookOutlined color="primary" sx={{ flexShrink: 0 }} /><Typography variant="h6" component="h2" fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{space.title}</Typography></Box><Typography color="text.secondary" sx={{ mt: 0.5 }}>{space.description}</Typography><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 'auto', pt: 2 }}><Chip size="small" label={`${docs.length} 篇文档`} />{recent && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>最近更新 {formatDate(recent.updatedAt || recent.date)}</Typography>}</Stack></Box></CardContent></CardActionArea></Card>; })}</Box>}
  </>;
}

function HeaderSpacePicker({ space, onChange }: { space: Space; onChange: (slug: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <Button aria-label={`切换文档空间：${space.title}`} aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)} endIcon={<KeyboardArrowDownRounded />} sx={{ minWidth: 0, width: 156, flexShrink: 0, justifyContent: 'space-between', px: 1.25, py: 0.75, bgcolor: 'action.hover', color: 'text.primary', borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}>
      <Typography component="span" variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>{space.title}</Typography>
    </Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      {visibleSpaces().map((option) => <MenuItem selected={option.slug === space.slug} key={option.slug} onClick={() => { onChange(option.slug); setAnchor(null); }}>{option.title}</MenuItem>)}
    </Menu>
  </>;
}

function AppShell({ children, currentSpace, activePath, mode, setMode }: { children: ReactNode; currentSpace?: Space; activePath: string; mode: ColorMode; setMode: (mode: ColorMode) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
  }, [resolvedMode]);
  const theme = useMemo(() => createDocsTheme(resolvedMode), [resolvedMode]);
  const hideNavigation = useMediaQuery('(max-width:1199px)');
  // On narrower screens hide the left navigation first. Keep the article TOC
  // available on small tablets, then remove it only when the content column
  // can no longer accommodate it.
  const hideToc = useMediaQuery('(max-width:767px)');
  const showDesktopSearch = useMediaQuery('(min-width:900px)');
  const currentEntry = entryForPath(currentSpace, activePath);
  const navigationVisible = Boolean(currentSpace) && !hideNavigation;
  const tocVisible = !hideToc && Boolean(currentEntry?.headings?.some((heading) => heading.depth > 1));
  const { widths, setNavigationWidth, setTocWidth, resetNavigationWidth, resetTocWidth } = usePanelWidths(navigationVisible, tocVisible, showDesktopSearch ? 220 : 200);
  const drawerWidth = widths.navigationWidth;
  const tocTopOffset = `calc(${appBarOffset} + 32px)`;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const query = new URLSearchParams(location.search).get('q') ?? '';
  const closeDrawer = () => setDrawerOpen(false);
  const navigateSpace = (slug: string) => { navigate('/spaces/' + slug); closeDrawer(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return <ThemeProvider theme={theme}><CssBaseline enableColorScheme />
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ pt: 'env(safe-area-inset-top)', borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.6), backdropFilter: 'blur(8px)', color: resolvedMode === 'dark' ? 'grey.500' : 'grey.800', zIndex: (value) => value.zIndex.drawer + 1 }}>
      <Toolbar sx={{ minHeight: appBarHeight + 'px !important', gap: { xs: 0.25, sm: 1.25 }, px: 0, pl: { xs: 'max(8px, env(safe-area-inset-left))', sm: 2.5 }, pr: { xs: 'max(8px, env(safe-area-inset-right))', sm: 2.5 } }}>
        {hideNavigation && currentSpace && <IconButton onClick={() => setDrawerOpen(true)} aria-label="打开导航" sx={{ minWidth: 44, minHeight: 44 }}><MenuRounded /></IconButton>}
        <MuiLink component={Link} to="/" underline="none" color="inherit" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: { xs: 0, md: 1.5 }, flexShrink: 0 }}><MenuBookOutlined color="primary" sx={{ fontSize: 28 }} /><Typography variant="h6" fontWeight={700}>文档</Typography></MuiLink>
        <Divider orientation="vertical" flexItem sx={{ height: 28, alignSelf: 'center', borderColor: 'divider', display: { xs: 'none', sm: 'block' } }} />
        {currentSpace && <Box sx={{ display: { xs: 'none', sm: 'block' } }}><HeaderSpacePicker space={currentSpace} onChange={navigateSpace} /></Box>}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="搜索"><IconButton onClick={() => setSearchOpen(true)} aria-label="搜索文档" sx={{ minWidth: 44, minHeight: 44, display: showDesktopSearch ? 'none' : 'inline-flex' }}><SearchRounded /></IconButton></Tooltip>
        <TextField hiddenLabel variant="filled" value={query} onClick={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSearchOpen(true); } }} placeholder="搜索文档..." size="small" aria-label="搜索文档" sx={{ width: { sm: 260, md: 420, lg: 500 }, flexShrink: 1, display: showDesktopSearch ? 'flex' : 'none', '& .MuiFilledInput-root': { height: 40, bgcolor: 'action.hover', borderRadius: 1, px: 1.5 }, '& .MuiFilledInput-root:hover': { bgcolor: 'action.selected' }, '& .MuiFilledInput-root.Mui-focused': { bgcolor: 'action.selected' } }} InputProps={{ disableUnderline: true, readOnly: true, startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">⌘ K</Typography></InputAdornment> }} />
        <BookmarksLink />
        <Tooltip title="切换主题"><IconButton onClick={() => setMode(resolvedMode === 'light' ? 'dark' : 'light')} aria-label="切换主题" sx={{ minWidth: 44, minHeight: 44 }}>{resolvedMode === 'light' ? <DarkModeOutlined /> : <LightModeOutlined />}</IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    {currentSpace && <Drawer variant={hideNavigation ? 'temporary' : 'permanent'} open={hideNavigation ? drawerOpen : true} onClose={closeDrawer} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: { xs: 'min(88vw, 320px)', sm: hideNavigation ? 300 : drawerWidth }, boxSizing: 'border-box', top: appBarOffset, height: `calc(100% - ${appBarOffset})`, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', pb: 'env(safe-area-inset-bottom)', borderRight: 1, borderColor: 'divider', bgcolor: 'background.default' } }}><SpaceNavigation space={currentSpace} activePath={activePath} close={closeDrawer} temporary={hideNavigation} /></Drawer>}
    <Box component="main" sx={{ ml: currentSpace && !hideNavigation ? drawerWidth + 'px' : 0, pt: appBarOffset, minHeight: '100vh', minWidth: 0, overflowX: 'clip' }}>
      <Container maxWidth={false} sx={{ maxWidth: currentEntry ? 'none' : 1320, minHeight: `calc(100vh - ${appBarOffset})`, display: 'flex', flexDirection: 'column', py: { xs: 2.5, sm: 4.5 }, pb: { xs: 'max(20px, env(safe-area-inset-bottom))', sm: 3 }, px: 0, pl: { xs: 'max(16px, env(safe-area-inset-left))', sm: 4, lg: 5 }, pr: { xs: 'max(16px, env(safe-area-inset-right))', sm: 4, lg: 5 } }}>
        <Box sx={{ display: 'flex', flex: '1 1 auto', minHeight: 0, gap: currentEntry ? { sm: 4, lg: 5 } : { sm: 3, md: 5 }, alignItems: 'stretch' }}>
          <Box sx={{ minWidth: 0, flex: '1 1 0%', display: 'flex' }}>
            <Box sx={{ width: '100%', maxWidth: currentEntry ? 1120 : 760, minWidth: 0, mx: currentEntry ? 'auto' : 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
          </Box>
          {tocVisible && <OnThisPage entry={currentEntry} width={widths.tocWidth} topOffset={tocTopOffset} />}
        </Box>
      </Container>
    </Box>
    {navigationVisible && <ResizeDivider label="调整左侧导航宽度" side="navigation" offset={drawerWidth} top={appBarOffset} bottom="0px" value={drawerWidth} min={widths.navigationMin} max={widths.navigationMax} onChange={setNavigationWidth} onReset={resetNavigationWidth} />}
    {tocVisible && <ResizeDivider label="调整右侧目录宽度" side="toc" offset={widths.tocWidth + (hideNavigation ? 32 : 40)} top={tocTopOffset} bottom="max(24px, env(safe-area-inset-bottom))" value={widths.tocWidth} min={widths.tocMin} max={widths.tocMax} onChange={setTocWidth} onReset={resetTocWidth} />}
    {currentEntry && <BackToTop key={currentEntry.route} right={tocVisible ? widths.tocWidth + (hideNavigation ? 64 : 80) : undefined} />}
    <SearchDialog open={searchOpen} initialQuery={query} currentSpace={currentSpace} onClose={() => setSearchOpen(false)} />
  </ThemeProvider>;
}

function useArticleReadingMemory(entry: ContentEntry | undefined, routeHash: string) {
  const { memories, save } = useReadingMemory();
  const memoriesRef = useRef(memories);
  const saveRef = useRef(save);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  useEffect(() => { saveRef.current = save; }, [save]);

  useEffect(() => {
    if (!entry?.sourcePath || entry.draft || typeof window === 'undefined') return undefined;
    const memory = findReadingMemory(memoriesRef.current, entry);
    let restoring = Boolean(memory && !routeHash);
    let interacted = false;
    let saveTimer: number | undefined;
    let restoreTimer: number | undefined;
    let restoreFrame: number | undefined;
    let attempts = 0;
    let previousHeight = -1;
    let stableFrames = 0;
    let lastKnownHash = routeHash;
    const rememberHash = () => {
      if (stripBasePath(window.location.pathname, import.meta.env.BASE_URL) === entry.route) lastKnownHash = window.location.hash;
      return lastKnownHash;
    };

    const savePosition = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const scrollTop = Math.max(0, Math.min(window.scrollY, maxScroll));
      saveRef.current(entry, {
        scrollTop,
        scrollRatio: maxScroll > 0 ? scrollTop / maxScroll : 0,
        // Keep hash changes made with history.replaceState on the same page,
        // while avoiding a destination hash during Link-navigation cleanup.
        hash: rememberHash(),
      });
    };
    const scheduleSave = () => {
      rememberHash();
      if (restoring) return;
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(savePosition, 180);
    };
    const persistOnExit = () => {
      // A browser can reset scrollY to 0 before pagehide/visibilitychange
      // during a reload. Keep the last useful position unless the reader
      // interacted with the current page at the top.
      if (interacted || window.scrollY > 0) savePosition();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistOnExit();
      else scheduleSave();
    };
    const cancelRestore = () => {
      if (!restoring) return;
      restoring = false;
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
    const handleInteraction = () => {
      interacted = true;
      cancelRestore();
    };
    const restorePosition = () => {
      if (!restoring || !memory) return;
      const height = document.documentElement.scrollHeight;
      const maxScroll = Math.max(0, height - window.innerHeight);
      let memoryHeading: HTMLElement | null = null;
      if (memory.hash) {
        let headingId = memory.hash;
        try { headingId = decodeURIComponent(headingId); } catch { /* use the stored id when it is not encoded */ }
        memoryHeading = document.getElementById(headingId);
      }
      if (memoryHeading) memoryHeading.scrollIntoView({ behavior: 'auto', block: 'start' });
      else {
        const ratioTarget = memory.scrollRatio * maxScroll;
        const target = Math.max(0, Math.min(maxScroll, ratioTarget || memory.scrollTop));
        window.scrollTo({ top: target, behavior: 'auto' });
      }
      attempts += 1;
      if (height === previousHeight) stableFrames += 1;
      else stableFrames = 0;
      previousHeight = height;
      // MDX pages render through a lazy module. Do not conclude that the
      // document is stable while the fallback spinner is still the only
      // content, otherwise restoration would stop at scrollTop 0.
      const contentReady = entry.sourcePath.endsWith('.mdx')
        ? Boolean(document.querySelector('.mdx-content'))
        : Boolean(document.querySelector('.rich-content'));
      if (attempts >= 40 || (contentReady && stableFrames >= 2)) {
        restoring = false;
        return;
      }
      restoreTimer = window.setTimeout(restorePosition, 100);
    };

    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('pagehide', persistOnExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (memory && !routeHash) {
      window.addEventListener('wheel', handleInteraction, { passive: true });
      window.addEventListener('touchstart', handleInteraction, { passive: true });
      window.addEventListener('pointerdown', handleInteraction, { passive: true });
      window.addEventListener('keydown', handleInteraction);
      restoreFrame = window.requestAnimationFrame(restorePosition);
    } else if (!routeHash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    return () => {
      if (saveTimer) window.clearTimeout(saveTimer);
      if (restoreTimer) window.clearTimeout(restoreTimer);
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener('scroll', scheduleSave);
      window.removeEventListener('pagehide', persistOnExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('wheel', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      if (interacted || !memory) savePosition();
    };
  }, [entry?.route, entry?.sourcePath, entry?.spaceSlug, entry?.draft, routeHash]);
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setModeState] = useState<ColorMode>(() => {
    try { return (localStorage.getItem('leo-learn-mode') as ColorMode | null) ?? 'dark'; }
    catch { return 'dark'; }
  });
  const setMode = (next: ColorMode) => {
    setModeState(next);
    try { localStorage.setItem('leo-learn-mode', next); } catch { /* Reading remains available when browser storage is blocked. */ }
  };
  const normalized = cleanTrailingSlash(location.pathname);
  const currentSpace = currentSpaceFor(normalized);
  const entry = entryForPath(currentSpace, normalized);
  useArticleReadingMemory(entry, location.hash);
  useEffect(() => { if (normalized !== location.pathname) navigate(`${normalized}${location.search}${location.hash}`, { replace: true }); }, [normalized, location.pathname, location.search, location.hash, navigate]);
  useEffect(() => { document.title = location.pathname === '/' ? 'Leo Learn' : `${normalized === '/bookmarks' ? '我的收藏' : entryForPath(currentSpaceFor(location.pathname), normalized)?.title ?? 'Leo Learn'} · Leo Learn`; }, [location.pathname, normalized]);
  useEffect(() => {
    if (!entry && !location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [entry, location.hash, location.pathname]);
  useEffect(() => {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep the raw hash when it is malformed */ }
    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    const scrollToHash = () => {
      if (cancelled) return;
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
      if (attempts < 30) {
        attempts += 1;
        retryTimer = window.setTimeout(scrollToHash, 100);
      }
    };
    const frame = requestAnimationFrame(scrollToHash);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [location.hash, location.pathname]);
  let content: ReactNode;
  if (normalized === '/') content = <SpacesHome />;
  else if (normalized === '/search') content = <SearchPage />;
  else if (normalized === '/bookmarks') content = <BookmarksPage spaces={asSpaces} />;
  else if (!currentSpace) content = <NotFound />;
  else if (normalized === `/spaces/${currentSpace.slug}`) content = <SpaceHome space={currentSpace} />;
  else if (entry) content = <DocPage entry={entry} space={currentSpace} />;
  else content = <NotFound space={currentSpace} />;
  return <AppShell currentSpace={currentSpace} activePath={normalized} mode={mode} setMode={setMode}>{content}</AppShell>;
}

function NotFound({ space }: { space?: Space }) {
  return <Box sx={{ py: 8, textAlign: 'center' }}><SearchOff color="disabled" sx={{ fontSize: 52 }} /><Typography variant="h4" sx={{ mt: 1, fontWeight: 750 }}>页面不存在</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>请从文档目录选择一个页面。</Typography><Button component={Link} to={space ? `/spaces/${space.slug}` : '/'} sx={{ mt: 2 }}>返回首页</Button></Box>;
}
