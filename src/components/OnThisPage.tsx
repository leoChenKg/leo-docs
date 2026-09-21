import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import type { ContentEntry } from '../types';

type OnThisPageProps = {
  entry?: ContentEntry;
  width: number;
  topOffset: string;
};

function currentHashId() {
  const hash = window.location.hash.slice(1);
  try { return decodeURIComponent(hash); } catch { return hash; }
}

export function OnThisPage({ entry, width, topOffset }: OnThisPageProps) {
  const headings = useMemo(() => entry?.headings?.filter((heading) => heading.depth > 1) ?? [], [entry?.headings]);
  const [activeId, setActiveId] = useState(currentHashId);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const revealHeading = useCallback((id: string) => {
    const container = scrollContainerRef.current;
    if (!container || container.clientHeight === 0) return;
    const link = Array.from(container.querySelectorAll<HTMLElement>('[data-heading-id]'))
      .find((item) => item.dataset.headingId === id);
    if (!link) return;

    const containerRect = container.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const padding = 8;
    const visibleTop = containerRect.top + container.clientTop + padding;
    const visibleBottom = containerRect.top + container.clientTop + container.clientHeight - padding;
    let delta = 0;
    if (linkRect.height > visibleBottom - visibleTop || linkRect.top < visibleTop) delta = linkRect.top - visibleTop;
    else if (linkRect.bottom > visibleBottom) delta = linkRect.bottom - visibleBottom;

    // Only scroll this pane. scrollIntoView would also move the article/page.
    if (Math.abs(delta) > 0.5) container.scrollTop += delta;
  }, []);

  useLayoutEffect(() => { revealHeading(activeId); }, [activeId, width, revealHeading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => revealHeading(activeId));
    observer.observe(container);
    // Width changes can rewrap links even when the pane's height is capped.
    const content = container.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [activeId, headings, revealHeading]);

  useEffect(() => {
    if (!headings.length) return undefined;
    const hashId = currentHashId();
    setActiveId(headings.some((heading) => heading.id === hashId) ? hashId : headings[0].id);
    const main = document.querySelector('main');
    let frame = 0;
    let observedContent: Element | null = null;

    const updateActiveHeading = () => {
      frame = 0;
      // Resolve the nodes afresh so lazy MDX, replaced content and restored
      // reading positions are handled without relying on intersection deltas.
      const content = main?.querySelector('.rich-content') ?? null;
      if (content !== observedContent) {
        if (observedContent) resizeObserver.unobserve(observedContent);
        observedContent = content;
        if (content) resizeObserver.observe(content);
      }
      const elements = headings.map((heading) => document.getElementById(heading.id))
        .filter((element): element is HTMLElement => Boolean(element && content?.contains(element) && element.getClientRects().length));
      if (!elements.length) return;
      const readingLine = scrollContainerRef.current?.getBoundingClientRect().top ?? 96;
      let nextId = elements[0].id;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0 && window.scrollY >= maxScroll - 2) {
        // The last heading may never reach the reading line on short final sections.
        nextId = elements[elements.length - 1].id;
      } else {
        for (const element of elements) {
          if (element.getBoundingClientRect().top <= readingLine + 1) nextId = element.id;
          else break;
        }
      }
      setActiveId(nextId);
      // Also restore visibility while scrolling within the same long section.
      revealHeading(nextId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveHeading);
    };
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => !scrollContainerRef.current?.contains(record.target))) scheduleUpdate();
    });
    if (main) {
      resizeObserver.observe(main);
      mutationObserver.observe(main, { childList: true, subtree: true, characterData: true });
    }
    scheduleUpdate();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [entry?.route, headings, revealHeading]);

  const selectHeading = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
  };

  if (!headings.length) return null;
  return (
    <Box sx={{ width, flexShrink: 0 }}>
      <Box ref={scrollContainerRef} component="aside" aria-label="本页目录" sx={{ width, position: 'fixed', top: topOffset, right: { sm: 32, lg: 40 }, maxHeight: `calc(100dvh - ${topOffset} - max(24px, env(safe-area-inset-bottom)))`, overflowY: 'auto', overscrollBehavior: 'contain', scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
        <Box sx={{ pl: 2, borderLeft: 1, borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.1, fontSize: 11 }}>本页目录</Typography>
          <List dense disablePadding sx={{ mt: 1 }}>
            {headings.map((heading) => (
              <ListItemButton component="a" href={`#${heading.id}`} key={heading.id} data-heading-id={heading.id} onClick={(event) => selectHeading(event, heading.id)} aria-current={activeId === heading.id ? 'location' : undefined} sx={{ py: 0.4, pl: 1.25, pr: 0.75, minHeight: 36, borderRadius: 0.75, borderLeft: '3px solid transparent', color: 'text.secondary', transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease', '& .MuiListItemText-primary': { color: 'inherit' }, '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }, ...(activeId === heading.id ? { color: 'primary.main', bgcolor: 'action.selected', borderLeftColor: 'transparent', '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 700 } } : {}) }}>
                <ListItemText primary={heading.text} primaryTypographyProps={{ variant: 'caption' }} sx={{ pl: Math.max(0, heading.depth - 2) * 1.5 }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Box>
    </Box>
  );
}
