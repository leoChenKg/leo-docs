import { alpha, type Theme } from '@mui/material/styles';

export const appBarHeight = 64;
export const appBarOffset = `calc(${appBarHeight}px + env(safe-area-inset-top))`;

export const appBarStyles = (theme: Theme) => ({
  pt: 'env(safe-area-inset-top)',
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: alpha(theme.palette.background.default, 0.6),
  backdropFilter: 'blur(8px)',
  color: theme.palette.mode === 'dark' ? 'grey.500' : 'grey.800',
});

export const toolbarStyles = {
  minHeight: `${appBarHeight}px !important`,
  gap: { xs: 0.25, sm: 1.25 },
  px: 0,
  pl: { xs: 'max(8px, env(safe-area-inset-left))', sm: 2.5 },
  pr: { xs: 'max(8px, env(safe-area-inset-right))', sm: 2.5 },
};
