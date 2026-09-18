import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AppBar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
  responsiveFontSizes,
  useMediaQuery,
} from '@mui/material';
import {
  ArticleOutlined,
  ArrowBack,
  ArrowForward,
  Brightness4,
  Brightness7,
  Code,
  FolderOutlined,
  HomeOutlined,
  Menu as MenuIcon,
  Search,
  SearchOff,
  SpaceBar,
  Close,
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { spaces } from './generated/content';
import type { ContentEntry, Space } from './types';
import { ContentRenderer } from './components/ContentRenderer';
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

const drawerWidth = 280;
const appBarHeight = 64;
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
      const route = `/spaces/${space.slug}/${parts.slice(0, index + 1).join('/')}`;
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

function NavigationTree({ directory, activePath, close }: { directory: Directory; activePath: string; close: () => void }) {
  const children = [...directory.children.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return (
    <List disablePadding>
      {directory.index && directory.index.body && directory.route !== directory.index.route && (
        <ListItemButton component={Link} to={directory.index.route} selected={activePath === directory.index.route} onClick={close} sx={{ minHeight: 42, pl: 2, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}><FolderOutlined fontSize="small" /></ListItemIcon>
          <ListItemText primary={directory.index.title} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
        </ListItemButton>
      )}
      {children.map((child) => (
        <Box key={child.route}>
          <ListItemButton component={Link} to={child.route} selected={activePath === child.route} onClick={close} sx={{ minHeight: 42, pl: 2, borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 32 }}><FolderOutlined fontSize="small" /></ListItemIcon>
            <ListItemText primary={child.index?.title ?? prettySegment(child.name)} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
          </ListItemButton>
          {(activePath === child.route || activePath.startsWith(`${child.route}/`)) && <Box sx={{ pl: 2 }}><NavigationTree directory={child} activePath={activePath} close={close} /></Box>}
        </Box>
      ))}
      {sortedDocs(directory).map((entry) => (
        <ListItemButton component={Link} to={entry.route} selected={activePath === entry.route} onClick={close} key={entry.route} sx={{ minHeight: 42, pl: 2, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}><ArticleOutlined fontSize="small" /></ListItemIcon>
          <ListItemText primary={entry.title} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
        </ListItemButton>
      ))}
    </List>
  );
}

function SpaceNavigation({ space, activePath, close, onSpaceChange }: { space: Space; activePath: string; close: () => void; onSpaceChange: (slug: string) => void }) {
  const tree = useMemo(() => buildDirectoryTree(space), [space]);
  return (
    <Box component="nav" aria-label={`${space.title} 文档导航`} sx={{ px: 1.5, py: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, px: 0.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel id="drawer-space-label">文档空间</InputLabel>
          <Select labelId="drawer-space-label" label="文档空间" value={space.slug} onChange={(event) => onSpaceChange(event.target.value)}>
            {visibleSpaces().map((option) => <MenuItem value={option.slug} key={option.slug}>{option.title}</MenuItem>)}
          </Select>
        </FormControl>
        <IconButton aria-label="关闭导航" onClick={close} sx={{ display: { md: 'none' }, minWidth: 44, minHeight: 44 }}><Close /></IconButton>
      </Stack>
      <ListItemButton component={Link} to={`/spaces/${space.slug}`} selected={activePath === `/spaces/${space.slug}`} onClick={close} sx={{ minHeight: 44, borderRadius: 1, mb: 1 }}>
        <ListItemIcon sx={{ minWidth: 32 }}><HomeOutlined fontSize="small" /></ListItemIcon>
        <ListItemText primary="概览" primaryTypographyProps={{ fontWeight: 650 }} />
      </ListItemButton>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, letterSpacing: 1.1 }}>文档目录</Typography>
      <NavigationTree directory={tree} activePath={activePath} close={close} />
    </Box>
  );
}

function normalizeBreadcrumbs(entry: ContentEntry, space: Space): Breadcrumb[] {
  const fromEntry = (entry as ContentEntry & { breadcrumbs?: Breadcrumb[] }).breadcrumbs;
  if (Array.isArray(fromEntry) && fromEntry.length > 0) return [{ title: space.title, route: `/spaces/${space.slug}` }, ...fromEntry];
  return [{ title: space.title, route: `/spaces/${space.slug}` }, ...entry.dirParts.map((part, index) => ({ title: prettySegment(part), route: `/spaces/${space.slug}/${entry.dirParts.slice(0, index + 1).join('/')}` }))];
}

function OnThisPage({ entry }: { entry?: ContentEntry }) {
  if (!entry?.headings?.length) return null;
  return (
    <Box component="aside" sx={{ width: 220, flexShrink: 0, display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 96, alignSelf: 'flex-start' }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>本页目录</Typography>
      <List dense disablePadding sx={{ mt: 1, borderLeft: 1, borderColor: 'divider' }}>
        {entry.headings.filter((heading) => heading.depth > 1).map((heading) => (
          <ListItemButton component="a" href={`#${heading.id}`} key={heading.id} sx={{ py: 0.45, pl: 1.5 + Math.max(0, heading.depth - 2) * 1.25, minHeight: 30 }}>
            <ListItemText primary={heading.text} primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

function EntryBreadcrumbs({ entry, space }: { entry: ContentEntry; space: Space }) {
  const crumbs = normalizeBreadcrumbs(entry, space);
  return (
    <Breadcrumbs aria-label="面包屑导航" sx={{ mb: 2 }}>
      {crumbs.map((crumb, index) => index < crumbs.length - 1 && crumb.route ? <MuiLink component={Link} to={crumb.route} underline="hover" color="inherit" key={`${crumb.route}-${crumb.title}`}>{crumb.title}</MuiLink> : <Typography color="text.primary" key={crumb.title}>{crumb.title}</Typography>)}
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
        {unique.map((entry) => <Card variant="outlined" key={entry.route}><CardActionArea component={Link} to={entry.route} sx={{ minHeight: 64 }}><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}><Typography variant="subtitle1" fontWeight={650}>{entry.title}</Typography>{entry.description && <Typography variant="body2" color="text.secondary" noWrap>{entry.description}</Typography>}</CardContent></CardActionArea></Card>)}
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
  return <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 6, pt: 2, borderTop: 1, borderColor: 'divider' }}><Box>{previous && <Button component={Link} to={previous.route} startIcon={<ArrowBack />} sx={{ textAlign: 'left', justifyContent: 'flex-start', minHeight: 44 }}><Box><Typography variant="caption" display="block" color="text.secondary">上一篇</Typography><Typography variant="body2">{previous.title}</Typography></Box></Button>}</Box><Box>{next && <Button component={Link} to={next.route} endIcon={<ArrowForward />} sx={{ textAlign: 'right', justifyContent: 'flex-end', minHeight: 44 }}><Box><Typography variant="caption" display="block" color="text.secondary">下一篇</Typography><Typography variant="body2">{next.title}</Typography></Box></Button>}</Box></Stack>;
}

function DocPage({ entry, space }: { entry: ContentEntry; space: Space }) {
  const isDirectoryIndex = entry.kind === 'index';
  const directoryRoute = entry.directoryRoute ?? entry.route;
  return <>
    <EntryBreadcrumbs entry={entry} space={space} />
    <Typography component="h1" variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{entry.title}</Typography>
    {entry.description && <Typography variant="h6" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6, fontWeight: 400 }}>{entry.description}</Typography>}
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2, mb: 3 }}>
      {entry.type !== 'doc' && <Chip size="small" label={entry.type} />}
      {(entry.updatedAt || entry.date) && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>更新于 {entry.updatedAt || entry.date}</Typography>}
      {entry.tags?.map((tag) => <Chip size="small" variant="outlined" label={tag} key={tag} />)}
    </Stack>
    <Divider sx={{ mb: 3 }} />
    {entry.body ? <ContentRenderer entry={{ ...entry, body: withoutPageTitle(entry) }} /> : <Typography color="text.secondary">这个目录还没有说明文档。</Typography>}
    {isDirectoryIndex && <DirectoryCards space={space} directoryRoute={directoryRoute} currentEntry={entry} />}
    <PrevNext space={space} entry={entry} />
  </>;
}

function SpaceHome({ space }: { space: Space }) {
  const index = space.entries.find((entry) => entry.kind === 'index' && entry.route === `/spaces/${space.slug}`);
  const docs = space.entries.filter((entry) => !entry.draft && entry.kind !== 'index').sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || '')).slice(0, 8);
  return <>
    <Breadcrumbs sx={{ mb: 2 }}><Typography color="text.secondary">文档空间</Typography><Typography color="text.primary">{space.title}</Typography></Breadcrumbs>
    <Stack direction="row" spacing={1} alignItems="center"><SpaceBar color="primary" /><Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>{space.title}</Typography></Stack>
    {space.description && <Typography variant="h6" color="text.secondary" sx={{ mt: 1, fontWeight: 400 }}>{space.description}</Typography>}
    {index?.body && <><Divider sx={{ my: 4 }} /><ContentRenderer entry={{ ...index, body: withoutPageTitle(index) }} /></>}
    <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 700 }}>最近文档</Typography>
    <Stack spacing={1.25}>{docs.map((entry) => <Card variant="outlined" key={entry.route}><CardActionArea component={Link} to={entry.route} sx={{ minHeight: 76 }}><CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}><Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="h6" fontWeight={650}>{entry.title}</Typography>{(entry.updatedAt || entry.date) && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{entry.updatedAt || entry.date}</Typography>}</Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{entry.description}</Typography></CardContent></CardActionArea></Card>)}{docs.length === 0 && <Typography color="text.secondary">这个空间还没有文档。</Typography>}</Stack>
  </>;
}

function SpacesHome() {
  const navigate = useNavigate();
  return <>
    <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>学习文档空间</Typography>
    <Typography variant="h6" color="text.secondary" sx={{ mt: 1, mb: 4, fontWeight: 400 }}>从一个空间开始阅读、整理和沉淀。</Typography>
    {visibleSpaces().length === 0 ? <Box sx={{ py: 8, textAlign: 'center' }}><SearchOff color="disabled" sx={{ fontSize: 48 }} /><Typography sx={{ mt: 1 }} color="text.secondary">还没有可展示的文档空间。</Typography></Box> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>{visibleSpaces().map((space) => { const docs = space.entries.filter((entry) => !entry.draft && entry.kind !== 'index'); const recent = docs.slice().sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''))[0]; return <Card variant="outlined" key={space.slug}><CardActionArea onClick={() => navigate(`/spaces/${space.slug}`)} sx={{ height: '100%', minHeight: 150 }}><CardContent sx={{ p: 2.5 }}><Stack direction="row" spacing={1.5} alignItems="flex-start"><Code color="primary" /><Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="h6" fontWeight={700}>{space.title}</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>{space.description}</Typography><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Chip size="small" label={`${docs.length} 篇文档`} />{recent && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>最近更新 {recent.updatedAt || recent.date}</Typography>}</Stack></Box></Stack></CardContent></CardActionArea></Card>; })}</Box>}
  </>;
}

function SearchDialog({ open, initialQuery, currentSpace, onClose }: { open: boolean; initialQuery: string; currentSpace?: Space; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState(currentSpace?.slug ?? 'all');
  useEffect(() => { if (open) { setQuery(initialQuery); setScope(currentSpace?.slug ?? 'all'); } }, [open, initialQuery, currentSpace?.slug]);
  const submit = () => { const value = query.trim(); if (!value) return; navigate(`/search?q=${encodeURIComponent(value)}${scope === 'all' ? '' : `&space=${scope}`}`); onClose(); };
  return <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} fullScreen={false}><DialogTitle>搜索文档</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField autoFocus fullWidth value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} placeholder="输入关键词" InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} /><FormControl fullWidth><InputLabel id="search-scope-label">搜索范围</InputLabel><Select labelId="search-scope-label" label="搜索范围" value={scope} onChange={(event) => setScope(event.target.value)}><MenuItem value="all">所有空间</MenuItem>{visibleSpaces().map((space) => <MenuItem key={space.slug} value={space.slug}>{space.title}</MenuItem>)}</Select></FormControl></Stack></DialogContent><DialogActions><Button onClick={onClose}>取消</Button><Button variant="contained" onClick={submit}>搜索</Button></DialogActions></Dialog>;
}

function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get('q')?.trim() ?? '';
  const selected = params.get('space');
  const scope = selected ? visibleSpaces().filter((space) => space.slug === selected) : visibleSpaces();
  const [scopeValue, setScopeValue] = useState(selected ?? 'all');
  const results = scope.flatMap((space) => space.entries.filter((entry) => !entry.draft && `${entry.title} ${entry.description} ${entry.body} ${(entry.tags ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase())).map((entry) => ({ space, entry })));
  return <>
    <Breadcrumbs sx={{ mb: 2 }}><Typography color="text.secondary">搜索</Typography></Breadcrumbs>
    <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>搜索结果</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2, mb: 3 }}><TextField fullWidth value={query} onChange={(event) => navigate(`/search?q=${encodeURIComponent(event.target.value)}${scopeValue === 'all' ? '' : `&space=${scopeValue}`}`)} placeholder="输入关键词" size="small" /><FormControl size="small" sx={{ minWidth: { sm: 180 } }}><InputLabel id="page-scope-label">范围</InputLabel><Select labelId="page-scope-label" label="范围" value={scopeValue} onChange={(event) => { setScopeValue(event.target.value); navigate(`/search?q=${encodeURIComponent(query)}${event.target.value === 'all' ? '' : `&space=${event.target.value}`}`); }}><MenuItem value="all">所有空间</MenuItem>{visibleSpaces().map((space) => <MenuItem key={space.slug} value={space.slug}>{space.title}</MenuItem>)}</Select></FormControl></Stack>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{query ? `“${query}”找到 ${results.length} 条结果` : '输入关键词搜索文档'}</Typography>
    <Stack spacing={1.25}>{results.map(({ space, entry }) => <Card variant="outlined" key={`${space.slug}:${entry.route}`}><CardActionArea component={Link} to={entry.route} sx={{ minHeight: 74 }}><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={space.title} /><Typography variant="h6" fontWeight={650}>{entry.title}</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{entry.description}</Typography></CardContent></CardActionArea></Card>)}{query && !results.length && <Typography color="text.secondary">没有匹配的文档。</Typography>}</Stack>
  </>;
}

function AppShell({ children, currentSpace, activePath, mode, setMode }: { children: ReactNode; currentSpace?: Space; activePath: string; mode: ColorMode; setMode: (mode: ColorMode) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedMode = mode === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  let theme = createTheme({ palette: { mode: resolvedMode, primary: { main: resolvedMode === 'dark' ? '#90caf9' : '#007fff' } }, shape: { borderRadius: 8 }, typography: { fontFamily: '"Inter", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' } });
  theme = responsiveFontSizes(theme);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const query = new URLSearchParams(location.search).get('q') ?? '';
  const closeDrawer = () => setDrawerOpen(false);
  const navigateSpace = (slug: string) => { navigate(`/spaces/${slug}`); closeDrawer(); };
  return <ThemeProvider theme={theme}><CssBaseline />
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', zIndex: (value) => value.zIndex.drawer + 1 }}>
      <Toolbar sx={{ minHeight: `${appBarHeight}px !important`, gap: 1 }}>
        {isMobile && <IconButton edge="start" onClick={() => setDrawerOpen(true)} aria-label="打开导航" sx={{ minWidth: 44, minHeight: 44 }}><MenuIcon /></IconButton>}
        <MuiLink component={Link} to="/" underline="none" color="inherit" sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: { xs: 0, sm: 2 } }}><Code color="primary" /><Typography variant="h6" fontWeight={800}>Leo Learn</Typography></MuiLink>
        {currentSpace && <FormControl size="small" sx={{ minWidth: 190, display: { xs: 'none', md: 'block' } }}><InputLabel id="top-space-label">文档空间</InputLabel><Select labelId="top-space-label" label="文档空间" value={currentSpace.slug} onChange={(event) => navigateSpace(event.target.value)}>{visibleSpaces().map((space) => <MenuItem value={space.slug} key={space.slug}>{space.title}</MenuItem>)}</Select></FormControl>}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="搜索"><IconButton onClick={() => setSearchOpen(true)} aria-label="搜索文档" sx={{ minWidth: 44, minHeight: 44, display: { xs: 'inline-flex', md: 'none' } }}><Search /></IconButton></Tooltip>
        <TextField value={query} onClick={() => setSearchOpen(true)} placeholder="搜索文档" size="small" sx={{ width: 240, display: { xs: 'none', md: 'flex' } }} InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <Tooltip title="切换主题"><IconButton onClick={() => setMode(resolvedMode === 'light' ? 'dark' : 'light')} aria-label="切换主题" sx={{ minWidth: 44, minHeight: 44 }}>{resolvedMode === 'light' ? <Brightness4 /> : <Brightness7 />}</IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    {currentSpace && <Drawer variant={isMobile ? 'temporary' : 'permanent'} open={isMobile ? drawerOpen : true} onClose={closeDrawer} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', top: `${appBarHeight}px`, height: `calc(100% - ${appBarHeight}px)`, borderRight: 1, borderColor: 'divider' } }}><SpaceNavigation space={currentSpace} activePath={activePath} close={closeDrawer} onSpaceChange={navigateSpace} /></Drawer>}
    <Box component="main" sx={{ ml: currentSpace && !isMobile ? `${drawerWidth}px` : 0, pt: `${appBarHeight}px`, minHeight: '100vh' }}><Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 }, px: { xs: 2, sm: 4 } }}><Box sx={{ display: 'flex', gap: { lg: 5 }, alignItems: 'flex-start' }}><Box sx={{ width: '100%', maxWidth: 760, minWidth: 0 }}>{children}</Box>{currentSpace && activePath !== '/search' && <OnThisPage entry={entryForPath(currentSpace, activePath)} />}</Box></Container></Box>
    <SearchDialog open={searchOpen} initialQuery={query} currentSpace={currentSpace} onClose={() => setSearchOpen(false)} />
  </ThemeProvider>;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setModeState] = useState<ColorMode>(() => (localStorage.getItem('leo-learn-mode') as ColorMode | null) ?? 'system');
  const setMode = (next: ColorMode) => { setModeState(next); localStorage.setItem('leo-learn-mode', next); };
  const normalized = cleanTrailingSlash(location.pathname);
  useEffect(() => { if (normalized !== location.pathname) navigate(`${normalized}${location.search}${location.hash}`, { replace: true }); }, [normalized, location.pathname, location.search, location.hash, navigate]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); document.title = location.pathname === '/' ? 'Leo Learn' : `${entryForPath(currentSpaceFor(location.pathname), normalized)?.title ?? 'Leo Learn'} · Leo Learn`; }, [location.pathname, normalized]);
  useEffect(() => { if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); }, [location.hash, location.pathname]);
  const currentSpace = currentSpaceFor(normalized);
  const entry = entryForPath(currentSpace, normalized);
  let content: ReactNode;
  if (normalized === '/') content = <SpacesHome />;
  else if (normalized === '/search') content = <SearchPage />;
  else if (!currentSpace) content = <NotFound />;
  else if (normalized === `/spaces/${currentSpace.slug}`) content = <SpaceHome space={currentSpace} />;
  else if (entry) content = <DocPage entry={entry} space={currentSpace} />;
  else content = <NotFound space={currentSpace} />;
  return <AppShell currentSpace={currentSpace} activePath={normalized} mode={mode} setMode={setMode}>{content}</AppShell>;
}

function NotFound({ space }: { space?: Space }) {
  const navigate = useNavigate();
  return <Box sx={{ py: 8, textAlign: 'center' }}><SearchOff color="disabled" sx={{ fontSize: 52 }} /><Typography variant="h4" sx={{ mt: 1, fontWeight: 750 }}>页面不存在</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>请从文档目录选择一个页面。</Typography><Button component={Link} to={space ? `/spaces/${space.slug}` : '/'} sx={{ mt: 2 }}>返回首页</Button></Box>;
}
