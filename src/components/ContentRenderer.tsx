import {
  Children, Component, Suspense, createContext, isValidElement, lazy,
  useContext, useEffect, useId, useMemo, useRef, useState,
  type ComponentType, type HTMLAttributes, type ReactNode,
} from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, AlertTitle, Box,
  Button, ButtonBase, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, Link, Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Tooltip, Typography,
  useTheme, type AlertColor, type AlertProps,
} from '@mui/material';
import { Close, ContentCopy, ExpandMore, OpenInFull, RestartAlt } from '@mui/icons-material';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import hljs from 'highlight.js/lib/common';
import type { VisualizationSpec } from 'vega-embed';
import type { ContentEntry } from '../types';
import './content.css';

const EntryContext = createContext<ContentEntry | null>(null);
type MdxModule = { default: ComponentType<{ components?: typeof MDXComponents }> };
type DemoModule = { default: ComponentType };
const mdxModules = import.meta.glob<MdxModule>('../../spaces/**/*.mdx');
const demoModules = import.meta.glob<DemoModule>([
  '../../spaces/**/components/**/Demo.tsx', '../../components/**/Demo.tsx',
]);
const demoSources = import.meta.glob<string>([
  '../../spaces/**/components/**/Demo.tsx', '../../components/**/Demo.tsx',
], { query: '?raw', import: 'default' });
const demoFallbacks = import.meta.glob<string>([
  '../../spaces/**/components/**/fallback.md', '../../components/**/fallback.md',
], { query: '?raw', import: 'default' });

function normalizePath(value: string) {
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function resolveHref(href: string | undefined, entry: ContentEntry | null, asset = false) {
  if (!href || !entry || /^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(href)) return href;
  const separator = href.search(/[?#]/);
  const pathname = separator === -1 ? href : href.slice(0, separator);
  const suffix = separator === -1 ? '' : href.slice(separator);
  const relativePath = normalizePath(`${entry.relativePath.split('/').slice(0, -1).join('/')}/${pathname}`);
  if (asset || /(?:^|\/)assets\//.test(relativePath) || /\.(?!mdx?(?:$))[^/.]+$/i.test(relativePath)) {
    return `/content/spaces/${entry.spaceSlug}/${relativePath}${suffix}`;
  }
  const route = relativePath.replace(/\.mdx?$/i, '').replace(/(?:^|\/)_index$/i, '');
  return `/spaces/${entry.spaceSlug}${route ? `/${route.replace(/\/$/, '')}` : ''}${suffix}`;
}

function ContentLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const entry = useContext(EntryContext);
  const resolved = resolveHref(href, entry);
  const ext = href?.split(/[?#]/)[0].toLowerCase() ?? '';
  if (/\.(mp4|webm|ogv)$/.test(ext)) return <Video src={href ?? ''} title={typeof children === 'string' ? children : '视频'} />;
  if (/\.(mp3|wav|m4a|ogg|flac)$/.test(ext)) return <Audio src={href ?? ''} title={typeof children === 'string' ? children : '音频'} />;
  return <Link {...props} href={resolved} target={href?.startsWith('http') ? '_blank' : props.target} rel={href?.startsWith('http') ? 'noreferrer' : props.rel}>{children}</Link>;
}

export function CodeBlock({ children, code, language = 'text', title }: { children?: ReactNode; code?: string; language?: string; title?: string }) {
  const source = (code ?? String(children ?? '')).replace(/\n$/, '');
  const [message, setMessage] = useState('');
  const highlighted = useMemo(() => hljs.getLanguage(language)
    ? hljs.highlight(source, { language, ignoreIllegals: true }).value
    : null, [language, source]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setMessage('代码已复制'); }
    catch { setMessage('复制失败，请手动选择代码复制'); }
  };
  return <Paper variant="outlined" className="content-code" sx={{ my: 2, overflow: 'hidden', bgcolor: 'var(--docs-code-background)', color: 'hsl(60, 30%, 96%)', borderColor: 'hsl(210, 14%, 13%)', colorScheme: 'dark' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.25, borderBottom: 1, borderColor: 'hsl(210, 14%, 13%)', bgcolor: 'var(--docs-code-title-background)', color: 'var(--docs-code-title-color)' }}>
      <Typography variant="caption" color="inherit" noWrap sx={{ minWidth: 0 }}>{title ?? language}</Typography>
      <Tooltip title="复制代码"><IconButton color="inherit" size="small" aria-label="复制代码" onClick={() => void copy()} sx={{ width: 44, height: 44, flexShrink: 0 }}><ContentCopy fontSize="small" /></IconButton></Tooltip>
    </Stack>
    <Box component="pre" sx={{ m: 0, p: 2, overflowX: 'auto', maxWidth: '100%', fontSize: '0.8125rem', lineHeight: 1.7 }} tabIndex={0} aria-label={`${language} 代码`}>
      {highlighted !== null ? <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} /> : <code>{source}</code>}
    </Box>
    <Snackbar open={Boolean(message)} autoHideDuration={2200} onClose={() => setMessage('')} message={message} />
  </Paper>;
}

export function Figure({ src, alt = '', caption, title }: { src: string; alt?: string; caption?: ReactNode; title?: string }) {
  const entry = useContext(EntryContext);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const resolved = resolveHref(src, entry, true);
  return <Box component="figure" sx={{ mx: 0, my: 3, maxWidth: '100%' }}>
    <ButtonBase className="content-figure-button" onClick={() => setOpen(true)} aria-label={`放大图片：${alt || title || '文档图片'}`} aria-haspopup="dialog" sx={{ position: 'relative', width: '100%', display: 'block', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Box component="img" src={resolved} alt={alt} loading="lazy" sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560, objectFit: 'contain' }} />
      <Box component="span" sx={{ position: 'absolute', right: 8, bottom: 8, bgcolor: 'background.paper', borderRadius: 1, p: 0.5, display: 'flex', boxShadow: 1 }}><OpenInFull fontSize="small" /></Box>
    </ButtonBase>
    {caption && <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>{caption}</Typography>}
    <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={titleId} maxWidth="lg" fullWidth>
      <DialogTitle id={titleId} sx={{ pr: 7 }}>{title || alt || '文档图片'}<IconButton onClick={() => setOpen(false)} aria-label="关闭图片" sx={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44 }}><Close /></IconButton></DialogTitle>
      <DialogContent><Box component="img" src={resolved} alt={alt} sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', mx: 'auto' }} /></DialogContent>
    </Dialog>
  </Box>;
}

export function Video({ src, title = '视频', poster, caption }: { src: string; title?: string; poster?: string; caption?: string }) {
  const entry = useContext(EntryContext);
  return <Box component="span" sx={{ display: 'block', my: 2 }}>
    <Box component="video" controls playsInline preload="metadata" src={resolveHref(src, entry, true)} poster={resolveHref(poster, entry, true)} aria-label={title} sx={{ width: '100%', display: 'block', maxHeight: 560, bgcolor: '#000', borderRadius: 1 }} />
    {caption && <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ mt: 1 }}>{caption}</Typography>}
  </Box>;
}

export function Audio({ src, title = '音频' }: { src: string; title?: string }) {
  const entry = useContext(EntryContext);
  return <Box component="span" sx={{ display: 'block', my: 2 }}><Box component="audio" controls preload="metadata" src={resolveHref(src, entry, true)} aria-label={title} sx={{ display: 'block', width: '100%', minWidth: 0 }} /></Box>;
}

export function ReferenceList({ items }: { items: Array<{ title: string; url: string; description?: string }> }) {
  return <Box component="ol" sx={{ pl: 3, my: 2 }}>{items.map((item, index) => <Box component="li" key={`${item.url}-${index}`} sx={{ mb: 1 }}><ContentLink href={item.url}>{item.title}</ContentLink>{item.description && <Typography variant="body2" color="text.secondary">{item.description}</Typography>}</Box>)}</Box>;
}

export function GlossaryTerm({ children, definition }: { children: ReactNode; definition: string }) {
  return <Tooltip title={definition} enterTouchDelay={0} leaveTouchDelay={4000} arrow><Box component="button" className="content-glossary-term" type="button" sx={{ cursor: 'help', font: 'inherit', color: 'inherit', p: 0, border: 0, bgcolor: 'transparent', borderBottom: '1px dotted', borderColor: 'primary.main' }}>{children}</Box></Tooltip>;
}

function SourceDetails({ source, language }: { source: string; language: string }) {
  return <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 44 }}><Typography variant="caption" color="text.secondary">查看图表源码</Typography></AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}><CodeBlock language={language} code={source} /></AccordionDetails>
  </Accordion>;
}

export function Mermaid({ children, code }: { children?: ReactNode; code?: string }) {
  const source = code ?? String(children ?? '');
  const id = useId().replace(/[^a-z\d]/gi, '');
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ svg: string; error: string; loading: boolean }>({ svg: '', error: '', loading: true });
  useEffect(() => {
    let active = true;
    setState({ svg: '', error: '', loading: true });
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme.palette.mode === 'dark' ? 'dark' : 'default', suppressErrorRendering: true });
        const result = await mermaid.render(`mermaid-${id}`, source);
        if (active) setState({ svg: result.svg, error: '', loading: false });
      } catch (error) {
        if (active) setState({ svg: '', error: error instanceof Error ? error.message : '请检查 Mermaid 语法。', loading: false });
      }
    })();
    return () => { active = false; };
  }, [source, id, theme.palette.mode]);
  return <Paper variant="outlined" sx={{ my: 3, overflow: 'hidden' }}>
    <Box sx={{ p: { xs: 1, sm: 2 }, overflowX: 'auto' }}>
      {state.loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">正在渲染图表…</Typography></Stack>}
      {state.error && <Alert severity="error"><AlertTitle>Mermaid 图表无法渲染</AlertTitle><Typography component="pre" variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>{state.error}</Typography></Alert>}
      {state.svg && <div ref={container} className="content-mermaid" role="img" aria-label="Mermaid 图表" dangerouslySetInnerHTML={{ __html: state.svg }} />}
    </Box>
    <Divider /><SourceDetails source={source} language="mermaid" />
  </Paper>;
}

export function Chart({ spec, code }: { spec?: VisualizationSpec; code?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const source = code ?? JSON.stringify(spec ?? {}, null, 2);
  useEffect(() => {
    let active = true;
    let finalize: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    const element = container.current;
    setError(''); setLoading(true);
    void (async () => {
      try {
        if (!element) return;
        const parsed: unknown = JSON.parse(source);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Vega-Lite 配置必须是 JSON 对象。');
        const input = parsed as Record<string, unknown>;
        const { default: embed } = await import('vega-embed');
        if (!active) return;
        const result = await embed(element, {
          ...input,
          ...(input.width === undefined ? { width: 'container' } : {}),
          background: 'transparent',
          config: {
            ...(typeof input.config === 'object' && input.config !== null ? input.config : {}),
            axis: { labelColor: theme.palette.text.secondary, titleColor: theme.palette.text.primary, gridColor: theme.palette.divider },
            legend: { labelColor: theme.palette.text.secondary, titleColor: theme.palette.text.primary },
            title: { color: theme.palette.text.primary },
          },
        } as VisualizationSpec, { actions: false, renderer: 'svg', mode: 'vega-lite' });
        finalize = () => result.finalize();
        if (!active) { finalize(); return; }
        observer = new ResizeObserver(() => { if (active) void result.view.resize().runAsync().catch(() => undefined); });
        observer.observe(element);
        setLoading(false);
      } catch (reason) {
        if (active) { setError(reason instanceof Error ? reason.message : '请检查 Vega-Lite JSON 配置。'); setLoading(false); }
      }
    })();
    return () => { active = false; observer?.disconnect(); finalize?.(); };
  }, [source, theme.palette.mode, theme.palette.text.primary, theme.palette.text.secondary, theme.palette.divider]);
  return <Paper variant="outlined" sx={{ my: 3, overflow: 'hidden' }}>
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 2, overflowX: 'auto' }}>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">正在渲染图表…</Typography></Stack>}
      {error && <Alert severity="error"><AlertTitle>数据图表无法渲染</AlertTitle>{error}</Alert>}
      <div ref={container} className="content-chart" role="img" aria-label="Vega-Lite 数据图表" />
    </Box>
    <Divider /><SourceDetails source={source} language="json" />
  </Paper>;
}

class ContentBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function findDemoKey(name: string, spaceSlug?: string) {
  if (!/^[a-z\d][a-z\d_/-]*$/i.test(name) || name.split('/').includes('..')) return undefined;
  const keys = Object.keys(demoModules).filter((key) => key.endsWith(`/${name}/Demo.tsx`));
  return keys.find((key) => key.startsWith(`../../spaces/${spaceSlug}/components/`)) ?? keys.find((key) => key.startsWith('../../components/'));
}

export function Demo({ name, title }: { name: string; title?: string }) {
  const entry = useContext(EntryContext);
  const demoKey = findDemoKey(name, entry?.spaceSlug);
  const [tab, setTab] = useState(0);
  const [reset, setReset] = useState(0);
  const [source, setSource] = useState('');
  const [fallback, setFallback] = useState('这个演示暂时无法运行，请查看源码。');
  const DemoComponent = useMemo(() => demoKey ? lazy(demoModules[demoKey]) : null, [demoKey]);
  useEffect(() => {
    let active = true;
    setSource(''); setFallback('这个演示暂时无法运行，请查看源码。'); setTab(0);
    if (demoKey) {
      void demoSources[demoKey]?.().then((value: string) => { if (active) setSource(value); }).catch(() => { if (active) setSource('// 暂时无法读取源码'); });
      const fallbackKey = demoKey.replace(/Demo\.tsx$/, 'fallback.md');
      void demoFallbacks[fallbackKey]?.().then((value: string) => { if (active) setFallback(value); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [demoKey]);
  const id = useId();
  if (!DemoComponent) return <Alert severity="warning" sx={{ my: 2 }}><AlertTitle>未找到演示：{name}</AlertTitle>请在当前空间或共享 components 目录中添加 {name}/Demo.tsx。</Alert>;
  return <Paper variant="outlined" sx={{ my: 3, overflow: 'hidden' }}>
    {title && <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>{title}</Typography>}
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label={`${title ?? name} 演示`} variant="scrollable" scrollButtons="auto" sx={{ minWidth: 0 }}>
        <Tab label="交互预览" id={`${id}-tab-0`} aria-controls={`${id}-panel-0`} />
        <Tab label="源码" id={`${id}-tab-1`} aria-controls={`${id}-panel-1`} />
      </Tabs>
      <Tooltip title={tab === 0 ? '重置演示' : '重置并返回预览'}><IconButton aria-label={tab === 0 ? '重置演示' : '重置并返回预览'} onClick={() => { setReset((value) => value + 1); setTab(0); }} sx={{ width: 44, height: 44, flexShrink: 0 }}><RestartAlt /></IconButton></Tooltip>
    </Stack>
    <Box role="tabpanel" hidden={tab !== 0} id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} tabIndex={0} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0, overflowX: 'auto' }}>
      <ContentBoundary key={`${demoKey}-${reset}`} fallback={<Alert severity="warning"><AlertTitle>演示暂时不可用</AlertTitle><Markdown content={fallback} /></Alert>}>
        <Suspense fallback={<Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">正在加载演示…</Typography></Stack>}><DemoComponent /></Suspense>
      </ContentBoundary>
    </Box>
    <Box role="tabpanel" hidden={tab !== 1} id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} tabIndex={0} sx={{ px: { xs: 1, sm: 2 }, minWidth: 0 }}><CodeBlock language="tsx" code={source || '// 正在读取源码…'} /></Box>
  </Paper>;
}

function DocAlert({ children, ...props }: AlertProps) {
  return <Alert {...props} sx={{ my: 2, ...props.sx }}>{children}</Alert>;
}

function FencedCode({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children).find((item) => isValidElement(item));
  const props = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child.props : {};
  const language = props.className?.match(/language-([^\s]+)/)?.[1] ?? 'text';
  const source = String(props.children ?? '').replace(/\n$/, '');
  if (language === 'mermaid') return <Mermaid code={source} />;
  if (language === 'vega-lite' || language === 'vega') return <Chart code={source} />;
  return <CodeBlock language={language} code={source} />;
}

const elements = {
  h1: (props: HTMLAttributes<HTMLHeadingElement>) => <Typography component="h1" variant="h3" {...props} sx={{ mt: 4, mb: 2, fontWeight: 700 }} />,
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => <Typography component="h2" variant="h4" {...props} sx={{ mt: 5, mb: 2, fontSize: { xs: '1.6rem', sm: '2rem' }, fontWeight: 700, scrollMarginTop: 90 }} />,
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => <Typography component="h3" variant="h5" {...props} sx={{ mt: 3.5, mb: 1.5, fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 650, scrollMarginTop: 90 }} />,
  h4: (props: HTMLAttributes<HTMLHeadingElement>) => <Typography component="h4" variant="h6" {...props} sx={{ mt: 3, mb: 1, scrollMarginTop: 90 }} />,
  a: ContentLink,
  hr: () => <Divider sx={{ my: 3 }} />,
  blockquote: ({ children }: { children?: ReactNode }) => <Box component="blockquote" sx={{ ml: 0, my: 2, pl: 2, borderLeft: 3, borderColor: 'primary.main', color: 'text.secondary' }}>{children}</Box>,
  pre: FencedCode,
  img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => <Figure src={src ?? ''} alt={alt} caption={title} />,
  table: ({ children }: { children?: ReactNode }) => <TableContainer className="content-table" component={Paper} variant="outlined" sx={{ my: 2, maxWidth: '100%' }} tabIndex={0} role="region" aria-label="文档表格，可横向滚动"><Table size="small">{children}</Table></TableContainer>,
  thead: ({ children }: { children?: ReactNode }) => <TableHead sx={{ bgcolor: 'action.hover' }}>{children}</TableHead>,
  tbody: ({ children }: { children?: ReactNode }) => <TableBody>{children}</TableBody>,
  tr: ({ children }: { children?: ReactNode }) => <TableRow>{children}</TableRow>,
  th: ({ children, style }: { children?: ReactNode; style?: React.CSSProperties }) => <TableCell component="th" sx={{ fontWeight: 700, minWidth: 100 }} style={style}>{children}</TableCell>,
  td: ({ children, style }: { children?: ReactNode; style?: React.CSSProperties }) => <TableCell style={style}>{children}</TableCell>,
};

const markdownComponents: Components = {
  ...elements,
  h1: ({ node: _node, ...props }) => <elements.h1 {...props} />,
  h2: ({ node: _node, ...props }) => <elements.h2 {...props} />,
  h3: ({ node: _node, ...props }) => <elements.h3 {...props} />,
  h4: ({ node: _node, ...props }) => <elements.h4 {...props} />,
  a: ({ node: _node, ...props }) => <ContentLink {...props} />,
  p: ({ node, children }) => node?.children.some((child) => child.type === 'element' && child.tagName === 'img')
    ? <Box>{children}</Box> : <Typography component="p" sx={{ my: 1.75, lineHeight: 1.85 }}>{children}</Typography>,
};

export const MDXComponents = {
  ...elements,
  p: ({ children }: { children?: ReactNode }) => <Box className="content-paragraph" sx={{ my: 1.75, lineHeight: 1.85 }}>{children}</Box>,
  Alert: DocAlert, AlertTitle, Button, Tabs, Tab, Accordion, AccordionSummary, AccordionDetails,
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell, Divider, Chip, Tag: Chip,
  Tooltip, Box, Stack, Typography, Paper, ButtonBase, Dialog, DialogTitle, DialogContent, Snackbar,
  CodeBlock, Figure, Video, Audio, ReferenceList,
  GlossaryTerm, Demo, Mermaid, Chart,
};

function Markdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeSlug]} components={markdownComponents}>{content}</ReactMarkdown>;
}

type Block = { kind: 'markdown'; content: string } | { kind: 'alert'; content: string; severity: AlertColor; title?: string } | { kind: 'demo'; name: string } | { kind: 'chart'; chartType: 'bar' | 'line'; title?: string; data: Array<{ label: string; value: number }> };

// Directives are recognized only outside fenced code; examples remain literal.
function parseBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let markdown: string[] = [];
  let fence: { char: string; length: number } | null = null;
  const trackFence = (line: string) => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!match) return;
    if (!fence) fence = { char: match[1][0], length: match[1].length };
    else if (match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) fence = null;
  };
  const flush = () => { if (markdown.length) blocks.push({ kind: 'markdown', content: markdown.join('\n') }); markdown = []; };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const alert = !fence && line.match(/^:::(info|success|warning|error|tip)(?:\s+(.+))?\s*$/i);
    const chart = !fence && line.match(/^:::chart(?:\s+(bar|line))?(?:\s+(.+))?\s*$/i);
    const demo = !fence && line.match(/^\{\{\s*["']demo["']\s*:\s*["']([^"']+)["']\s*\}\}\s*$/);
    if (chart) {
      flush();
      const rows: string[] = [];
      let end = i + 1;
      for (; end < lines.length; end += 1) {
        if (/^:::\s*$/.test(lines[end])) break;
        rows.push(lines[end]);
      }
      const data = rows.map((row) => row.match(/^\s*([^:]+):\s*(-?\d+(?:\.\d+)?)\s*$/)).filter(Boolean).map((match) => ({ label: match![1].trim(), value: Number(match![2]) }));
      blocks.push({ kind: 'chart', chartType: chart[1]?.toLowerCase() === 'line' ? 'line' : 'bar', title: chart[2]?.trim(), data });
      i = end;
    } else if (alert) {
      flush();
      const content: string[] = [];
      let end = i + 1;
      for (; end < lines.length; end += 1) {
        if (!fence && /^:::\s*$/.test(lines[end])) break;
        trackFence(lines[end]); content.push(lines[end]);
      }
      if (end === lines.length) { markdown.push(line, ...content); break; }
      blocks.push({ kind: 'alert', severity: (alert[1].toLowerCase() === 'tip' ? 'info' : alert[1].toLowerCase()) as AlertColor, title: alert[2], content: content.join('\n') });
      i = end;
    } else if (demo) {
      flush(); blocks.push({ kind: 'demo', name: demo[1] });
    } else { trackFence(line); markdown.push(line); }
  }
  flush(); return blocks;
}

function MarkdownContent({ body }: { body: string }) {
  return <>{parseBlocks(body).map((block, index) => block.kind === 'markdown'
    ? <Markdown key={index} content={block.content} />
    : block.kind === 'demo' ? <Demo key={index} name={block.name} />
      : block.kind === 'chart' ? <SimpleChart key={index} {...block} />
        : <DocAlert key={index} severity={block.severity}>{block.title && <AlertTitle>{block.title}</AlertTitle>}<Markdown content={block.content} /></DocAlert>)}</>;
}

function SimpleChart({ chartType, title, data }: Extract<Block, { kind: 'chart' }>) {
  if (!data.length) return <DocAlert severity="warning">图表没有可展示的数据，请使用 `标签: 数值` 格式。</DocAlert>;
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  return <Paper variant="outlined" sx={{ my: 3, p: { xs: 2, sm: 3 } }}>
    {title && <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>{title}</Typography>}
    <Stack spacing={1.25}>{data.map((item) => <Stack direction="row" spacing={1.5} alignItems="center" key={item.label}>
      <Typography variant="body2" sx={{ width: { xs: 64, sm: 110 }, flexShrink: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</Typography>
      <Box sx={{ flex: 1, height: 26, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}><Box sx={{ width: `${Math.max(3, Math.abs(item.value) / max * 100)}%`, height: '100%', bgcolor: chartType === 'line' ? 'secondary.main' : 'primary.main', borderRadius: 1 }} /></Box>
      <Typography variant="body2" sx={{ width: 40, textAlign: 'right' }}>{item.value}</Typography>
    </Stack>)}</Stack>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>图表数据写在 `:::chart` 块中，也可以使用 vega-lite 代码块获得更丰富的图表。</Typography>
  </Paper>;
}

export function ContentRenderer({ entry }: { entry: ContentEntry }) {
  const moduleKey = `../../${entry.sourcePath}`;
  const Page = useMemo(() => mdxModules[moduleKey] ? lazy(mdxModules[moduleKey]) : null, [moduleKey]);
  const body = entry.body.replace(/^\s*#\s+[^\n]+\n/, '');
  return <EntryContext.Provider value={entry}>
    <Box className="rich-content" sx={{ minWidth: 0 }}>
      {entry.sourcePath.endsWith('.mdx') && Page
        ? <ContentBoundary key={entry.sourcePath} fallback={<Alert severity="error"><AlertTitle>文档组件无法加载</AlertTitle>请检查当前 MDX 文件中的组件及其代码。</Alert>}>
          <Suspense fallback={<CircularProgress size={24} aria-label="正在加载文档" />}><Box className="mdx-content"><Page components={MDXComponents} /></Box></Suspense>
        </ContentBoundary>
        : <MarkdownContent body={body} />}
    </Box>
  </EntryContext.Provider>;
}
