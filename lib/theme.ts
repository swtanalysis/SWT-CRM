import { createTheme, ThemeOptions } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export const getDesignTokens = (mode: ColorMode): ThemeOptions => {
  // Mint green base scale
  const mint = {
    50: '#f2fdfa',
    100: '#d6f7ee',
    200: '#b3f0e0',
    300: '#89e6d0',
    400: '#5ad9bd',
    500: '#2bcba8', // primary main (light)
    600: '#1fae90',
    700: '#178f77',
    800: '#106f5d',
    900: '#094f43'
  };
  const darkAdjust = (hex: string, factor = 0.15) => hex; // keep simple; could add real algorithm
  const primaryMain = mode === 'light' ? mint[500] : mint[300];
  const primaryDark = mode === 'light' ? mint[700] : mint[500];
  const primaryLight = mode === 'light' ? mint[300] : mint[100];

  return {
    palette: {
      mode,
      primary: {
        main: primaryMain,
        dark: primaryDark,
        light: primaryLight,
        contrastText: '#04352c'
      },
      secondary: {
        main: mode === 'light' ? '#117a65' : '#4dd4bf'
      },
      success: { main: mint[600] },
      info: { main: mode === 'light' ? '#33bfae' : '#5ad9bd' },
      warning: { main: '#ffb347' },
      error: { main: '#e57373' },
      background: {
        default: mode === 'light' ? '#effcf9' : '#0e1f1d',
        paper: mode === 'light' ? '#ffffff' : '#142825'
      },
      divider: mode === 'light' ? '#b7e5dd' : '#24574f'
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, Arial, sans-serif'
    },
    components: {
      MuiPaper: { styleOverrides: { root: { transition: 'background-color 0.3s ease', backgroundImage: 'none' } } },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
          containedPrimary: { boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }
        }
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
      MuiTableHead: { styleOverrides: { root: { backgroundColor: mode === 'light' ? mint[100] : '#1d3b37' } } },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: 'linear-gradient(135deg, rgba(43,203,168,0.08) 0%, rgba(23,143,119,0.04) 60%)'
          },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-track': { background: mode === 'light' ? '#e3f7f2' : '#132522' },
            '::-webkit-scrollbar-thumb': { background: mode === 'light' ? '#9ddfcc' : '#2b5d52', borderRadius: 8 }
        }
      }
    }
  };
};

export const createAppTheme = (mode: ColorMode) => createTheme(getDesignTokens(mode));
