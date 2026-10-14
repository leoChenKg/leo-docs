import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AppBar, Box, Button, Dialog, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { AccountTreeOutlined, AddRounded, CenterFocusStrongRounded, CloseRounded, RemoveRounded } from '@mui/icons-material';
import { appBarStyles, toolbarStyles } from '../layout/header-styles';
import { constrainDiagram, fitDiagram, zoomDiagram, type DiagramTransform, type Point, type Size } from './diagram-viewport';

const MAX_SCALE = 16;
const ZOOM_STEP = 1.25;

function DiagramCanvas({ svg, titleId, onClose }: { svg: string; titleId: string; onClose: () => void }) {
  const helpId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const geometry = useRef<{ diagram: Size; viewport: Size } | null>(null);
  const transformRef = useRef<DiagramTransform>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, Point>());
  const autoFit = useRef(true);
  const [transform, setTransform] = useState(transformRef.current);
  const [diagramSize, setDiagramSize] = useState<Size | null>(null);
  const [dragging, setDragging] = useState(false);
  const markup = useMemo(() => ({ __html: svg }), [svg]);

  useLayoutEffect(() => {
    // Narrow layouts make <html> scrollable; MUI's body lock alone cannot stop it.
    const root = document.documentElement;
    const overflowY = root.style.overflowY;
    root.style.overflowY = 'hidden';
    return () => { root.style.overflowY = overflowY; };
  }, []);

  function apply(next: DiagramTransform) {
    if (!geometry.current) return;
    const { diagram, viewport } = geometry.current;
    const constrained = constrainDiagram(next, diagram, viewport);
    transformRef.current = constrained;
    setTransform(constrained);
  }

  function minScale() {
    if (!geometry.current) return 0.1;
    return Math.min(0.1, fitDiagram(geometry.current.diagram, geometry.current.viewport).scale / 4);
  }

  function zoom(scale: number, from?: Point, to = from) {
    if (!geometry.current) return;
    const { viewport } = geometry.current;
    const anchor = from ?? { x: viewport.width / 2, y: viewport.height / 2 };
    autoFit.current = false;
    apply(zoomDiagram(transformRef.current, scale, anchor, to ?? anchor, minScale(), MAX_SCALE));
  }

  function fit() {
    if (!geometry.current) return;
    autoFit.current = true;
    apply(fitDiagram(geometry.current.diagram, geometry.current.viewport));
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const svgElement = diagramRef.current?.querySelector('svg');
    if (!viewport || !svgElement) return;
    const viewBox = svgElement.viewBox.baseVal;
    const diagram = {
      width: viewBox.width || svgElement.width.baseVal.value || 800,
      height: viewBox.height || svgElement.height.baseVal.value || 600,
    };
    setDiagramSize(diagram);

    const resize = () => {
      const nextViewport = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (!nextViewport.width || !nextViewport.height) return;
      const previous = geometry.current;
      geometry.current = { diagram, viewport: nextViewport };
      // Preserve the reader's position on rotation; an untouched view stays fitted.
      if (!previous || autoFit.current) fit();
      else apply({
        ...transformRef.current,
        x: transformRef.current.x + (nextViewport.width - previous.viewport.width) / 2,
        y: transformRef.current.y + (nextViewport.height - previous.viewport.height) / 2,
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const delta = Math.max(-200, Math.min(200, event.deltaY * unit));
      zoom(transformRef.current.scale * Math.exp(-delta * 0.005), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    // React's delegated wheel listener is passive; cancel only canvas gestures.
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('wheel', wheel);
      pointers.current.clear();
    };
  }, [svg]);

  function point(event: PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    setDragging(true);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, point(event));
    const after = [...pointers.current.values()];
    if (before.length === 1) {
      autoFit.current = false;
      apply({ ...transformRef.current, x: transformRef.current.x + after[0].x - before[0].x, y: transformRef.current.y + after[0].y - before[0].y });
    } else {
      const middle = (points: Point[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const distance = (points: Point[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const previousDistance = distance(before);
      if (previousDistance > 0) zoom(transformRef.current.scale * distance(after) / previousDistance, middle(before), middle(after));
    }
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(pointers.current.size > 0);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const pan = event.shiftKey ? 100 : 40;
    const moves: Record<string, Point> = { ArrowLeft: { x: pan, y: 0 }, ArrowRight: { x: -pan, y: 0 }, ArrowUp: { x: 0, y: pan }, ArrowDown: { x: 0, y: -pan } };
    if (event.key === '+' || event.key === '=') zoom(transformRef.current.scale * ZOOM_STEP);
    else if (event.key === '-') zoom(transformRef.current.scale / ZOOM_STEP);
    else if (event.key === '0' || event.key === 'Home') fit();
    else if (moves[event.key]) {
      autoFit.current = false;
      apply({ ...transformRef.current, x: transformRef.current.x + moves[event.key].x, y: transformRef.current.y + moves[event.key].y });
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  return <>
    <AppBar className="mermaid-viewer-appbar" position="relative" color="inherit" elevation={0} sx={(theme) => ({ ...appBarStyles(theme), flexShrink: 0, zIndex: 1 })}>
      <Toolbar sx={toolbarStyles}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
          <AccountTreeOutlined color="primary" sx={{ fontSize: 28, display: { xs: 'none', sm: 'block' } }} />
          <Typography id={titleId} component="h2" variant="h6" fontWeight={700} noWrap><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Mermaid </Box>图表</Typography>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" alignItems="center" sx={{ flexShrink: 0, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Tooltip title="缩小（−）"><span><IconButton color="inherit" aria-label="缩小图表" disabled={transform.scale <= minScale() + 1e-8} onClick={() => zoom(transformRef.current.scale / ZOOM_STEP)} sx={{ width: 44, height: 44 }}><RemoveRounded fontSize="small" /></IconButton></span></Tooltip>
          <Typography component="output" aria-label="图表缩放比例" sx={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>{Math.round(transform.scale * 100)}%</Typography>
          <Tooltip title="放大（+）"><span><IconButton color="inherit" aria-label="放大图表" disabled={transform.scale >= MAX_SCALE} onClick={() => zoom(transformRef.current.scale * ZOOM_STEP)} sx={{ width: 44, height: 44 }}><AddRounded fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        <Tooltip title="适应窗口（0）"><Button color="inherit" aria-label="适应窗口" onClick={fit} sx={{ flexShrink: 0, minWidth: 44, minHeight: 44, px: { xs: 0, sm: 1.25 }, gap: 0.75, whiteSpace: 'nowrap' }}>
          <CenterFocusStrongRounded fontSize="small" /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>适应窗口</Box>
        </Button></Tooltip>
        <Tooltip title="关闭（Esc）"><IconButton color="inherit" autoFocus onClick={onClose} aria-label="关闭图表" sx={{ flexShrink: 0, width: 44, height: 44 }}><CloseRounded /></IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    <Box ref={viewportRef} className="mermaid-viewer-viewport" role="region" aria-label="图表画布" aria-describedby={helpId} tabIndex={0}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onKeyDown={keyDown}
      // Let panned content pass behind the translucent header; the dialog clips it.
      sx={{ flex: '1 1 0', minHeight: 0, minWidth: 0, position: 'relative', overflow: 'visible', touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
      <div ref={diagramRef} className="mermaid-viewer-diagram" role="img" aria-label="Mermaid 图表"
        style={{ width: diagramSize?.width, height: diagramSize?.height, visibility: diagramSize ? 'visible' : 'hidden', transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        dangerouslySetInnerHTML={markup} />
    </Box>
    <Typography id={helpId} variant="caption" color="text.secondary" sx={{ position: 'relative', zIndex: 1, bgcolor: 'background.default', flexShrink: 0, textAlign: 'center', px: 2, pt: 1, pb: 'max(8px, env(safe-area-inset-bottom))', userSelect: 'none' }}>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>滚轮缩放 · 拖动查看 · 画布聚焦后 + / − 缩放，方向键移动，0 适应窗口</Box>
      <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>双指缩放 · 单指拖动 · 适应窗口查看全图</Box>
    </Typography>
  </>;
}

export function MermaidViewer({ svg, onClose }: { svg: string; onClose: () => void }) {
  const titleId = useId();
  return <Dialog open fullScreen onClose={onClose} aria-labelledby={titleId} transitionDuration={0}
    onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopPropagation(); } }}
    sx={{ height: '100dvh' }} slotProps={{ paper: { sx: { bgcolor: 'background.default', backgroundImage: 'none', overflow: 'hidden', height: '100%', minHeight: 0 } } }}>
    <DiagramCanvas svg={svg} titleId={titleId} onClose={onClose} />
  </Dialog>;
}
