import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link as MuiLink,
  ListItemButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArticleOutlined, ArrowForwardRounded, CloseRounded, SearchOffRounded, SearchRounded } from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getSearchFacets,
  highlightText,
  readSearchFilters,
  searchContent,
  searchDocuments,
  searchUrl,
  type SearchFilters,
  type SearchResult,
} from '../search';
import type { Space } from '../types';

const typeLabels: Record<string, string> = {
  doc: '文档',
  note: '笔记',
  index: '目录',
  project: '项目',
  reference: '参考',
};

function displayType(type: string) {
  return typeLabels[type] ?? type;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date).replaceAll('/', '-');
}

function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlightText(text, query).map((part, index) => part.match ? (
    <Box
      component="mark"
      key={index}
      sx={{
        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.25 : 0.13),
        color: 'inherit',
        borderRadius: '2px',
        fontWeight: 700,
      }}
    >{part.text}</Box>
  ) : part.text)}</>;
}

function SearchFilterFields({ filters, onChange }: {
  filters: SearchFilters;
  onChange: (next: Partial<SearchFilters>) => void;
}) {
  const id = useId();
  const facets = useMemo(() => getSearchFacets(searchDocuments, filters.space), [filters.space]);
  const changeSpace = (space: string) => {
    const nextFacets = getSearchFacets(searchDocuments, space);
    onChange({
      space,
      tag: nextFacets.tags.includes(filters.tag) ? filters.tag : '',
      type: nextFacets.types.includes(filters.type) ? filters.type : '',
    });
  };
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
      <FormControl fullWidth variant="filled" size="small">
        <InputLabel id={`${id}-space`}>文档空间</InputLabel>
        <Select
          labelId={`${id}-space`}
          value={filters.space}
          onChange={(event) => changeSpace(event.target.value)}
          disableUnderline
        >
          <MenuItem value="">所有空间</MenuItem>
          {filters.space && !facets.spaces.some((space) => space.slug === filters.space) && (
            <MenuItem value={filters.space}>{filters.space}（不存在）</MenuItem>
          )}
          {facets.spaces.map((space) => <MenuItem key={space.slug} value={space.slug}>{space.title}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl fullWidth variant="filled" size="small">
        <InputLabel id={`${id}-tag`}>标签</InputLabel>
        <Select labelId={`${id}-tag`} value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })} disableUnderline>
          <MenuItem value="">所有标签</MenuItem>
          {filters.tag && !facets.tags.includes(filters.tag) && <MenuItem value={filters.tag}>{filters.tag}</MenuItem>}
          {facets.tags.map((tag) => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl fullWidth variant="filled" size="small">
        <InputLabel id={`${id}-type`}>类型</InputLabel>
        <Select labelId={`${id}-type`} value={filters.type} onChange={(event) => onChange({ type: event.target.value })} disableUnderline>
          <MenuItem value="">所有类型</MenuItem>
          {filters.type && !facets.types.includes(filters.type) && <MenuItem value={filters.type}>{displayType(filters.type)}</MenuItem>}
          {facets.types.map((type) => <MenuItem key={type} value={type}>{displayType(type)}</MenuItem>)}
        </Select>
      </FormControl>
    </Box>
  );
}

function ResultContent({ result, query, compact = false }: { result: SearchResult; query: string; compact?: boolean }) {
  const { document, heading, snippet } = result;
  const updated = formatDate(document.updatedAt);
  const path = [document.spaceTitle, ...document.directory].join(' / ');
  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
        {path}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
        <ArticleOutlined sx={{ fontSize: 19, flexShrink: 0, color: 'primary.main' }} />
        <Typography component={compact ? 'span' : 'h2'} variant={compact ? 'subtitle1' : 'h6'} fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Highlight text={document.title} query={query} />
        </Typography>
      </Box>
      {heading && (
        <Typography variant="body2" color="primary.main" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          § <Highlight text={heading.text} query={query} />
        </Typography>
      )}
      {snippet && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7, overflowWrap: 'anywhere' }}>
          <Highlight text={snippet} query={query} />
        </Typography>
      )}
      <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" spacing={0.75} sx={{ mt: 1.25 }}>
        {document.type && <Chip size="small" label={displayType(document.type)} />}
        {document.tags.map((tag) => (
          <Chip key={tag} size="small" label={<Highlight text={tag} query={query} />} sx={{ maxWidth: '100%', bgcolor: 'action.hover' }} />
        ))}
        {!compact && updated && <Typography variant="caption" color="text.secondary">更新于 {updated}</Typography>}
      </Stack>
    </Box>
  );
}

function EmptyResults({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <Box sx={{ py: 5, px: 2, textAlign: 'center' }}>
      <SearchOffRounded color="disabled" sx={{ fontSize: 40 }} />
      <Typography fontWeight={650} sx={{ mt: 1 }}>没有找到匹配的文档</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>试试更短的关键词，或扩大搜索范围。</Typography>
      {filtered && <Button onClick={onClear} sx={{ mt: 1.5 }}>清空筛选</Button>}
    </Box>
  );
}

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readSearchFilters(location.search), [location.search]);
  const results = useMemo(() => searchContent(searchDocuments, filters), [filters]);
  const filtered = Boolean(filters.space || filters.tag || filters.type);
  const update = (next: Partial<SearchFilters>, replace = false) => navigate(searchUrl({ ...filters, ...next }), { replace });
  const clearFilters = () => update({ space: '', tag: '', type: '' });
  const query = filters.query.trim();

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to="/" underline="hover" color="inherit">文档空间</MuiLink>
        <Typography color="text.primary" aria-current="page">搜索</Typography>
      </Breadcrumbs>
      <Typography component="h1" variant="h3" fontWeight={800}>搜索文档</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>搜索标题、正文、章节和标签，也可以按条件浏览。</Typography>
      <Stack spacing={1.5} sx={{ mt: 3 }}>
        <TextField
          variant="filled"
          hiddenLabel
          fullWidth
          value={filters.query}
          onChange={(event) => update({ query: event.target.value }, true)}
          placeholder="搜索标题、正文或标签"
          inputProps={{ 'aria-label': '搜索关键词', type: 'search' }}
          InputProps={{
            disableUnderline: true,
            startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment>,
            endAdornment: filters.query ? <InputAdornment position="end"><IconButton size="small" aria-label="清空关键词" onClick={() => update({ query: '' }, true)}><CloseRounded fontSize="small" /></IconButton></InputAdornment> : undefined,
          }}
          sx={{ '& input::-webkit-search-cancel-button': { display: 'none' } }}
        />
        <SearchFilterFields filters={filters} onChange={update} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mt: 2, mb: 2 }}>
        <Typography role="status" variant="body2" color="text.secondary" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
          {query ? `“${query}”找到 ${results.length} 条结果` : `共 ${results.length} 篇文档`}
        </Typography>
        {filtered && <Button size="small" onClick={clearFilters} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>清空筛选</Button>}
        <FormControl variant="filled" size="small" sx={{ width: { xs: '100%', sm: 160 }, flexShrink: 0 }}>
          <InputLabel id="search-sort-label">排序</InputLabel>
          <Select labelId="search-sort-label" value={filters.sort} disableUnderline onChange={(event) => update({ sort: event.target.value })}>
            <MenuItem value="relevance">相关度</MenuItem>
            <MenuItem value="updated">最近更新</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {results.length ? (
        <Stack component="ul" spacing={1.25} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {results.map((result) => (
            <Card component="li" variant="outlined" key={result.document.route}>
              <CardActionArea component={Link} to={result.href}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                  <ResultContent result={result} query={filters.query} />
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      ) : <EmptyResults filtered={filtered} onClear={clearFilters} />}
    </>
  );
}

export function SearchDialog({ open, initialQuery, currentSpace, onClose }: {
  open: boolean;
  initialQuery: string;
  currentSpace?: Space;
  onClose: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const id = useId();
  const [filters, setFilters] = useState<SearchFilters>(() => ({ ...readSearchFilters(''), query: initialQuery, space: currentSpace?.slug ?? '' }));
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLElement | null)[]>([]);
  const results = useMemo(() => searchContent(searchDocuments, filters), [filters]);
  const preview = results.slice(0, 8);
  const filtered = Boolean(filters.space || filters.tag || filters.type);

  useEffect(() => {
    if (!open) return;
    const initial = readSearchFilters(location.pathname === '/search' ? location.search : '');
    setFilters({ ...initial, query: initialQuery, space: location.pathname === '/search' ? initial.space : currentSpace?.slug ?? '' });
    setSelectedIndex(-1);
  }, [open, initialQuery, currentSpace?.slug, location.pathname, location.search]);

  useEffect(() => {
    const list = listRef.current;
    const option = optionRefs.current[selectedIndex];
    if (!list || !option) return;
    // Only scroll the result list; keep the page and input focus in place.
    const listBounds = list.getBoundingClientRect();
    const optionBounds = option.getBoundingClientRect();
    if (optionBounds.top < listBounds.top) list.scrollTop -= listBounds.top - optionBounds.top;
    if (optionBounds.bottom > listBounds.bottom) list.scrollTop += optionBounds.bottom - listBounds.bottom;
  }, [selectedIndex]);

  const update = (next: Partial<SearchFilters>) => {
    setFilters((previous) => ({ ...previous, ...next }));
    setSelectedIndex(-1);
    if (listRef.current) listRef.current.scrollTop = 0;
  };
  const showAll = () => {
    navigate(searchUrl(filters));
    onClose();
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!preview.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setSelectedIndex((previous) => previous < 0 ? (direction > 0 ? 0 : preview.length - 1) : (previous + direction + preview.length) % preview.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && preview[selectedIndex]) {
        navigate(preview[selectedIndex].href);
        onClose();
      } else showAll();
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
      PaperProps={{ sx: { m: { xs: 1, sm: 4 }, width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}
    >
      <DialogTitle id={`${id}-title`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 3 }, py: 1.5 }}>
        搜索文档
        <IconButton aria-label="关闭搜索" onClick={onClose} size="small"><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 0 }}>
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          <TextField
            variant="filled"
            hiddenLabel
            autoFocus
            fullWidth
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
            onKeyDown={onInputKeyDown}
            placeholder="搜索标题、正文、章节或标签"
            inputProps={{
              'aria-label': '搜索关键词',
              role: 'combobox',
              'aria-autocomplete': 'list',
              'aria-expanded': preview.length > 0,
              'aria-controls': `${id}-results`,
              'aria-activedescendant': selectedIndex >= 0 && preview[selectedIndex] ? `${id}-result-${selectedIndex}` : undefined,
              autoComplete: 'off',
            }}
            InputProps={{
              disableUnderline: true,
              startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment>,
              endAdornment: filters.query ? <InputAdornment position="end"><IconButton size="small" aria-label="清空关键词" onClick={() => update({ query: '' })}><CloseRounded fontSize="small" /></IconButton></InputAdornment> : undefined,
            }}
          />
          <SearchFilterFields filters={filters} onChange={update} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography role="status" variant="caption" color="text.secondary">
              {filters.query.trim() ? `找到 ${results.length} 条结果` : `共 ${results.length} 篇文档`}{results.length > 8 ? '，展示前 8 条' : ''}
            </Typography>
            {filtered && <Button size="small" onClick={() => update({ space: '', tag: '', type: '' })}>清空筛选</Button>}
          </Stack>
        </Stack>
        <Box
          ref={listRef}
          id={`${id}-results`}
          role="listbox"
          aria-label="搜索结果"
          sx={{ maxHeight: 'min(45dvh, 420px)', overflowY: 'auto', overscrollBehavior: 'contain', mt: 1, pb: 0.5 }}
        >
          {preview.map((result, index) => (
            <ListItemButton
              component={Link}
              to={result.href}
              role="option"
              id={`${id}-result-${index}`}
              ref={(element) => { optionRefs.current[index] = element; }}
              aria-selected={selectedIndex === index}
              selected={selectedIndex === index}
              key={result.document.route}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClose}
              sx={{ borderRadius: 1, alignItems: 'flex-start', py: 1.5, px: 1.5, mb: 0.5, '&.Mui-selected': { bgcolor: 'action.selected' } }}
            >
              <ResultContent result={result} query={filters.query} compact />
            </ListItemButton>
          ))}
        </Box>
        {!preview.length && <EmptyResults filtered={filtered} onClear={() => update({ space: '', tag: '', type: '' })} />}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 3 }, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>↑ ↓ 选择 · Enter 打开 · Esc 关闭</Typography>
        <Button onClick={showAll} endIcon={<ArrowForwardRounded />} sx={{ ml: 'auto' }}>查看全部结果</Button>
      </DialogActions>
    </Dialog>
  );
}
