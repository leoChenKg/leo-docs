import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { clampPanelWidth } from '../layout/panel-widths';

type ResizeDividerProps = {
  label: string;
  side: 'navigation' | 'toc';
  offset: number;
  top: string;
  bottom: string;
  value: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  onReset: () => void;
};

export function ResizeDivider({ label, side, offset, top, bottom, value, min, max, onChange, onReset }: ResizeDividerProps) {
  const drag = useRef<{ pointerId: number; x: number; width: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const direction = side === 'navigation' ? 1 : -1;
  const update = (width: number) => onChange(clampPanelWidth(width, min, max));
  const finish = () => { drag.current = null; setDragging(false); };

  useEffect(() => {
    if (!dragging) return;
    const style = document.documentElement.style;
    const previousCursor = style.cursor;
    const previousSelection = style.userSelect;
    style.cursor = 'col-resize';
    style.userSelect = 'none';
    return () => { style.cursor = previousCursor; style.userSelect = previousSelection; };
  }, [dragging]);

  return <Box
    role="separator"
    aria-label={label}
    aria-orientation="vertical"
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={Math.round(value)}
    aria-valuetext={`${Math.round(value)} 像素`}
    tabIndex={0}
    title={`${label}；方向键调整，双击恢复默认`}
    onFocus={(event) => setKeyboardFocus(event.currentTarget.matches(':focus-visible'))}
    onBlur={() => setKeyboardFocus(false)}
    onPointerDown={(event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      // Pointer focus must not leave a keyboard focus highlight after dragging.
      setKeyboardFocus(false);
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, x: event.clientX, width: value, moved: false };
      setDragging(true);
    }}
    onPointerMove={(event) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - drag.current.x) >= 1) drag.current.moved = true;
      if (!drag.current.moved) return;
      update(drag.current.width + direction * (event.clientX - drag.current.x));
    }}
    onPointerUp={(event) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      if (drag.current.moved || Math.abs(event.clientX - drag.current.x) >= 1) {
        update(drag.current.width + direction * (event.clientX - drag.current.x));
      }
      finish();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={finish}
    onLostPointerCapture={finish}
    onDoubleClick={onReset}
    onKeyDown={(event) => {
      setKeyboardFocus(true);
      const step = event.shiftKey ? 40 : 16;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        update(value + (event.key === 'ArrowRight' ? 1 : -1) * direction * step);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        update(event.key === 'Home' ? min : max);
      }
    }}
    sx={{
      position: 'fixed', top, bottom, width: 12,
      ...(side === 'navigation' ? { left: offset - 6 } : { right: offset - 6 }),
      zIndex: (theme) => side === 'navigation' ? theme.zIndex.drawer : 1,
      cursor: 'col-resize', touchAction: 'none', userSelect: 'none', outline: 'none',
      '&::after': { content: '""', position: 'absolute', insetBlock: 0, left: 5, width: 2, bgcolor: dragging || keyboardFocus ? 'primary.main' : 'transparent', borderRadius: 1 },
      '&:hover::after': { bgcolor: 'primary.main' },
    }}
  />;
}
