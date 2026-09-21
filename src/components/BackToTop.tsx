// Adapted from MUI's docs BackToTop component (MIT).
// https://github.com/mui/material-ui/blob/cf3f914c950bf9134344ae56de8e42b746ae975c/packages-internal/core-docs/src/AppLayout/components/BackToTop.tsx
// Copyright (c) 2014 Call-Em-All. See THIRD_PARTY_NOTICES.md.
import { useState } from 'react';
import { Box, Fab, Fade, Tooltip, useMediaQuery, useScrollTrigger } from '@mui/material';
import { KeyboardArrowUpRounded } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

export function BackToTop({ right }: { right?: number }) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 200 });

  const handleClick = () => {
    // Remove a chapter anchor so refreshing after returning to the top does not
    // send the reader back to that chapter. Preserve React Router's state.
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    }
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    setOpen(false);
  };

  return <Fade in={trigger} timeout={reducedMotion ? 0 : undefined} unmountOnExit>
    <Box className="mui-fixed" sx={{ position: 'fixed', bottom: 'max(24px, env(safe-area-inset-bottom))', right: { xs: 'max(16px, env(safe-area-inset-right))', sm: right ?? 'max(24px, env(safe-area-inset-right))' }, zIndex: 10 }}>
      <Tooltip title="回到顶部" placement="left" open={open && trigger} onClose={() => setOpen(false)} onOpen={() => setOpen(true)}>
        <Fab size="small" aria-label="回到顶部" onClick={handleClick} sx={(theme) => ({
          width: 44, height: 44,
          color: 'primary.main',
          bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.paper,
          border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.35),
          boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.5 : 0.12)}`,
          '&:hover': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100] },
        })}>
          <KeyboardArrowUpRounded />
        </Fab>
      </Tooltip>
    </Box>
  </Fade>;
}
