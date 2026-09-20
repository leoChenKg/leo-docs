import { alpha, createTheme, responsiveFontSizes, type PaletteMode } from '@mui/material/styles';

// MUI docs branding palette (not the Material UI default or the example templates):
// https://github.com/mui/material-ui/blob/master/packages-internal/core-docs/src/branding/brandingTheme.ts
const blue = {
  50: 'hsl(210, 100%, 96%)', 100: 'hsl(210, 100%, 90%)', 200: 'hsl(210, 100%, 80%)',
  300: 'hsl(210, 100%, 70%)', 400: 'hsl(210, 100%, 60%)', 500: 'hsl(210, 100%, 45%)',
  600: 'hsl(210, 100%, 42%)', 700: 'hsl(210, 100%, 38%)', 800: 'hsl(210, 100%, 30%)', 900: 'hsl(210, 100%, 23%)',
};
const blueDark = {
  50: 'hsl(210, 14%, 92%)', 100: 'hsl(210, 14%, 87%)', 200: 'hsl(210, 14%, 72%)',
  300: 'hsl(210, 14%, 56%)', 400: 'hsl(210, 14%, 36%)', 500: 'hsl(210, 14%, 28%)',
  600: 'hsl(210, 14%, 22%)',
  700: 'hsl(210, 14%, 13%)',
  800: 'hsl(210, 14%, 9%)',
  900: 'hsl(210, 14%, 7%)',
};
const grey = {
  50: 'hsl(215, 15%, 97%)', 100: 'hsl(215, 15%, 92%)',
  200: 'hsl(215, 15%, 89%)', 300: 'hsl(215, 15%, 82%)',
  400: 'hsl(215, 15%, 75%)', 500: 'hsl(215, 15%, 65%)',
  600: 'hsl(215, 15%, 50%)', 700: 'hsl(215, 15%, 40%)',
  800: 'hsl(215, 15%, 22%)', 900: 'hsl(215, 15%, 12%)',
};
const error = {
  50: 'hsl(355, 98%, 97%)', 100: 'hsl(355, 98%, 93%)', 200: 'hsl(355, 98%, 87%)',
  300: 'hsl(355, 98%, 80%)', 400: 'hsl(355, 98%, 74%)', 500: 'hsl(355, 98%, 66%)',
  600: 'hsl(355, 98%, 46%)', 700: 'hsl(355, 98%, 39%)', 800: 'hsl(355, 98%, 29%)', 900: 'hsl(355, 98%, 17%)',
};
const success = {
  50: 'hsl(144, 72%, 95%)', 100: 'hsl(144, 72%, 87%)', 200: 'hsl(144, 72%, 77%)',
  300: 'hsl(144, 72%, 66%)', 400: 'hsl(144, 72%, 56%)', 500: 'hsl(144, 72%, 46%)',
  600: 'hsl(144, 72%, 41%)', 700: 'hsl(144, 72%, 37%)', 800: 'hsl(144, 72%, 32%)', 900: 'hsl(144, 72%, 21%)',
};
const warning = {
  50: 'hsl(48, 100%, 96%)', 100: 'hsl(48, 100%, 88%)', 200: 'hsl(48, 100%, 82%)',
  300: 'hsl(48, 100%, 64%)', 400: 'hsl(48, 100%, 48%)', 500: 'hsl(48, 100%, 44%)',
  600: 'hsl(40, 100%, 40%)', 700: 'hsl(36, 100%, 34%)', 800: 'hsl(36, 100%, 27%)', 900: 'hsl(36, 100%, 18%)',
};

export function createDocsTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const primary = dark ? blue[400] : blue[500];
  return responsiveFontSizes(createTheme({
    palette: {
      mode,
      primary: { ...blue, main: primary, contrastText: '#fff' },
      secondary: { ...blueDark, main: dark ? blueDark[700] : blueDark[100], contrastText: blueDark[600] },
      background: { default: dark ? blueDark[900] : '#fff', paper: dark ? alpha(blueDark[800], 0.8) : '#fff' },
      text: { primary: dark ? '#fff' : grey[900], secondary: dark ? grey[400] : grey[800] },
      divider: dark ? alpha(blueDark[500], 0.3) : grey[100],
      grey,
      common: { black: 'hsl(200, 10%, 4%)' },
      error: { ...error, main: error[500] },
      success: { ...success, main: dark ? success[600] : success[700] },
      warning: { ...warning, main: warning[500] },
    },
    shape: { borderRadius: 8 },
    typography: { fontFamily: 'Inter, "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--docs-toc-node': dark ? grey[500] : grey[600],
            '--docs-primary': primary,
            '--docs-primary-soft': alpha(primary, 0.18),
            // MUI's docs use the Okaidia code surface in both color modes.
            '--docs-code-background': 'hsl(210, 25%, 9%)',
            '--docs-inline-code-background': dark ? grey[900] : grey[50],
            '--docs-inline-code-border': dark ? alpha(blueDark[600], 0.6) : grey[200],
            '--docs-text-primary': dark ? '#fff' : grey[900],
            '--docs-prose-color': dark ? grey[400] : grey[900],
            '--docs-code-title-background': blueDark[900],
            '--docs-code-title-color': grey[200],
          },
        },
      },
      // Docs surfaces do not use Material Design's white elevation overlay.
      // Keep dialogs and mobile drawers opaque, so content behind them cannot bleed through.
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', backgroundColor: dark ? blueDark[900] : '#fff' },
          outlined: { borderColor: dark ? blueDark[700] : grey[100], backgroundColor: dark ? alpha(blueDark[800], 0.6) : '#fff' },
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: dark ? alpha(blueDark[700], 0.45) : alpha(grey[50], 0.9),
            '&:before, &:after': { display: 'none' },
            '&:hover': { backgroundColor: dark ? alpha(blueDark[700], 0.65) : grey[50] },
            '&.Mui-focused': {
              backgroundColor: dark ? alpha(blueDark[700], 0.65) : grey[50],
              boxShadow: `inset 0 -2px 0 ${primary}`,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { '& .MuiOutlinedInput-notchedOutline': { border: 0 } },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: ({ ownerState }) => ownerState.color === 'primary' ? {
            color: dark ? blue[300] : blue[600],
            '&:hover': { color: dark ? blue[200] : blue[700] },
          } : {},
        },
      },
      // Callout colors from MUI docs' MarkdownElement; keep our existing Alert layout.
      MuiAlert: {
        styleOverrides: {
          standardInfo: {
            color: dark ? grey[50] : grey[900],
            backgroundColor: dark ? alpha(grey[700], 0.15) : grey[50],
            '& .MuiAlert-icon': { color: dark ? grey[400] : grey[600] },
            '& a': { color: dark ? blue[300] : blue[600] },
          },
          standardSuccess: {
            color: dark ? success[50] : success[900],
            backgroundColor: dark ? alpha(success[700], 0.12) : success[50],
            '& .MuiAlert-icon': { color: dark ? success[500] : success[600] },
            '& a': { color: dark ? success[100] : success[900] },
          },
          standardWarning: {
            color: dark ? warning[50] : grey[900],
            backgroundColor: dark ? alpha(warning[700], 0.12) : alpha(warning[50], 0.5),
            '& .MuiAlert-icon': { color: dark ? warning[400] : warning[600] },
            '& a': { color: dark ? warning[100] : warning[800] },
          },
          standardError: {
            color: dark ? error[50] : error[900],
            backgroundColor: dark ? alpha(error[700], 0.15) : error[50],
            '& .MuiAlert-icon': { color: dark ? error[500] : error[600] },
            '& a': { color: dark ? error[200] : error[800] },
          },
        },
      },
    },
  }));
}
