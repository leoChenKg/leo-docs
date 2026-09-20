import { useMemo, useState } from 'react';
import {
  Alert, Box, Breadcrumbs, Button, Card, CardContent, Chip,
  FormControl, IconButton, InputAdornment, InputLabel, Link as MuiLink,
  MenuItem, Select, Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { BookmarkBorderRounded, BookmarkRounded, CloseRounded, SearchRounded } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { resolveBookmarks } from '../bookmarks/model';
import { useBookmarks } from '../bookmarks/store';
import type { ContentEntry, Space } from '../types';

function savedDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(value)).replaceAll('/', '-');
}

export function BookmarksLink() {
  const selected = useLocation().pathname === '/bookmarks';
  const label = '我的收藏';
  return (
    <Tooltip title={label}>
      <IconButton component={Link} to="/bookmarks" aria-label={label} aria-current={selected ? 'page' : undefined}
        color={selected ? 'primary' : 'inherit'} sx={{ width: 44, height: 44, flexShrink: 0 }}>
        {selected ? <BookmarkRounded /> : <BookmarkBorderRounded />}
      </IconButton>
    </Tooltip>
  );
}

export function BookmarkButton({ entry, space }: { entry: ContentEntry; space: Space }) {
  const { bookmarks, add, remove } = useBookmarks();
  const [message, setMessage] = useState('');
  const saved = useMemo(() => resolveBookmarks(bookmarks, [space]).find((item) => item.entry?.route === entry.route), [bookmarks, space, entry.route]);
  const toggle = () => {
    const result = saved ? remove(saved.bookmark.id) : add(entry, space);
    setMessage(result.ok ? saved ? '已取消收藏' : '已加入我的收藏' : result.error ?? '收藏保存失败，请重试');
  };
  if (!entry.sourcePath || entry.draft || space.hidden) return null;
  return <>
    <Button onClick={toggle} startIcon={saved ? <BookmarkRounded /> : <BookmarkBorderRounded />}
      aria-label={saved ? '取消收藏' : '收藏文章'} aria-pressed={Boolean(saved)}
      variant="text"
      sx={{
        minHeight: 36,
        px: 1.25,
        borderRadius: 999,
        flexShrink: 0,
        color: saved ? 'primary.main' : 'text.secondary',
        '&:hover': { bgcolor: 'action.hover' },
      }}>
      {saved ? '已收藏' : '收藏'}
    </Button>
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={3000} onClose={() => setMessage('')}
      action={<IconButton color="inherit" aria-label="关闭收藏提示" onClick={() => setMessage('')} sx={{ width: 44, height: 44 }}><CloseRounded fontSize="small" /></IconButton>} />
  </>;
}

export function BookmarksPage({ spaces }: { spaces: readonly Space[] }) {
  const { bookmarks, error, remove } = useBookmarks();
  const [query, setQuery] = useState('');
  const [spaceFilter, setSpaceFilter] = useState('');
  const [message, setMessage] = useState('');
  const all = useMemo(() => resolveBookmarks(bookmarks, spaces), [bookmarks, spaces]);
  const scopeOptions = useMemo(() => [...new Map(all.map(({ bookmark, space }) =>
    [space?.slug ?? bookmark.spaceSlug, space?.title ?? bookmark.spaceTitle])).entries()], [all]);
  const currentScope = scopeOptions.some(([slug]) => slug === spaceFilter) ? spaceFilter : '';
  const results = useMemo(() => {
    const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
    return all.filter(({ bookmark, entry, space }) => {
      if (currentScope && (space?.slug ?? bookmark.spaceSlug) !== currentScope) return false;
      const text = [entry?.title ?? bookmark.title, entry?.description ?? bookmark.description,
        space?.title ?? bookmark.spaceTitle, ...(entry?.tags ?? bookmark.tags)].join(' ').normalize('NFKC').toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [all, currentScope, query]);
  const cancel = (id: string) => {
    const result = remove(id);
    setMessage(result.ok ? '已取消收藏' : result.error ?? '取消收藏失败，请重试');
  };
  return <>
    <Breadcrumbs sx={{ mb: 2 }}>
      <MuiLink component={Link} to="/" underline="hover" color="inherit">文档空间</MuiLink>
      <Typography color="text.primary" aria-current="page">我的收藏</Typography>
    </Breadcrumbs>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'baseline' }} spacing={{ xs: 0.5, sm: 1.5 }}>
      <Typography component="h1" variant="h3" fontWeight={800}>我的收藏</Typography>
      {all.length > 0 && <Typography variant="body2" color="text.secondary">共 {all.length} 篇</Typography>}
    </Stack>
    <Typography color="text.secondary" sx={{ mt: 1 }}>收藏常用文档，按收藏时间从新到旧排列。仅保存在当前浏览器，清除网站数据会移除收藏。</Typography>
    {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
    {all.length > 0 ? <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3, mb: 2 }}>
        <TextField fullWidth variant="filled" hiddenLabel value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选收藏标题、简介或标签" inputProps={{ 'aria-label': '筛选收藏', type: 'search' }}
          InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment>,
            endAdornment: query ? <InputAdornment position="end"><IconButton aria-label="清空收藏关键词" onClick={() => setQuery('')} sx={{ width: 44, height: 44 }}><CloseRounded /></IconButton></InputAdornment> : undefined }}
          sx={{ minWidth: 0, '& input::-webkit-search-cancel-button': { display: 'none' } }} />
        <FormControl variant="filled" sx={{ minWidth: { sm: 180 }, flexShrink: 0 }}>
          <InputLabel id="bookmark-space-label" shrink>文档空间</InputLabel>
          <Select labelId="bookmark-space-label" value={currentScope} onChange={(event) => setSpaceFilter(event.target.value)} disableUnderline displayEmpty
            renderValue={(value) => value ? scopeOptions.find(([slug]) => slug === value)?.[1] : '所有空间'}>
            <MenuItem value="">所有空间</MenuItem>
            {scopeOptions.map(([slug, title]) => <MenuItem key={slug} value={slug}>{title}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 2 }}>
        {query.trim() || currentScope ? `找到 ${results.length} / ${all.length} 篇收藏` : `共 ${all.length} 篇收藏`}
      </Typography>
      {results.length > 0 ? <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {results.map(({ bookmark, entry, space }) => <Card component="li" variant="outlined" key={bookmark.id}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">{space?.title ?? bookmark.spaceTitle}</Typography>
                <Typography component="h2" variant="h6" fontWeight={700} sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {entry ? <MuiLink component={Link} to={entry.route} underline="hover" color="text.primary">{entry.title}</MuiLink> : bookmark.title}
                </Typography>
              </Box>
              <Tooltip title="取消收藏"><IconButton aria-label={`取消收藏：${entry?.title ?? bookmark.title}`} onClick={() => cancel(bookmark.id)} color="primary" sx={{ width: 44, height: 44, flexShrink: 0 }}><BookmarkRounded /></IconButton></Tooltip>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>
              {entry?.description ?? bookmark.description}
            </Typography>
            {!entry && <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>文档暂不可用，可能已移动、删除或隐藏；可取消此收藏。</Typography>}
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ mt: 1.5 }}>
              {(entry?.tags ?? bookmark.tags).map((tag) => <Chip key={tag} size="small" label={tag} sx={{ maxWidth: '100%', bgcolor: 'action.hover' }} />)}
              <Typography variant="caption" color="text.secondary">收藏于 {savedDate(bookmark.savedAt)}</Typography>
            </Stack>
          </CardContent>
        </Card>)}
      </Stack> : <Box sx={{ py: 5, textAlign: 'center' }}>
        <Typography color="text.secondary">没有符合筛选条件的收藏</Typography>
        <Button sx={{ mt: 1, minHeight: 44 }} onClick={() => { setQuery(''); setSpaceFilter(''); }}>清空筛选</Button>
      </Box>}
    </> : <Box sx={{ py: 7, textAlign: 'center' }}>
      <BookmarkBorderRounded color="disabled" sx={{ fontSize: 48 }} />
      <Typography variant="h6" sx={{ mt: 1 }}>还没有收藏</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>阅读文章时点击标题下方的“收藏”，即可在这里快速找到。</Typography>
      <Button component={Link} to="/" sx={{ mt: 2, minHeight: 44 }}>浏览文档空间</Button>
    </Box>}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={3000} onClose={() => setMessage('')}
      action={<IconButton color="inherit" aria-label="关闭收藏提示" onClick={() => setMessage('')} sx={{ width: 44, height: 44 }}><CloseRounded fontSize="small" /></IconButton>} />
  </>;
}
