import { createTheme, ThemeOptions } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export const getDesignTokens = (mode: ColorMode): ThemeOptions => ({
  palette: {
    mode,
    primary: { main: mode === 'light' ? '#1976d2' : '#90caf9' },
    secondary: { main: mode === 'light' ? '#9c27b0' : '#ce93d8' },
    background: {
      default: mode === 'light' ? '#f4f6f8' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e'
    }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiPaper: { styleOverrides: { root: { transition: 'background-color 0.3s ease' } } },
    MuiAppBar: { styleOverrides: { root: { transition: 'background-color 0.3s ease' } } }
  }
});

export const createAppTheme = (mode: ColorMode) => createTheme(getDesignTokens(mode));
