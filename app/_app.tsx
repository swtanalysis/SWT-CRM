import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

function MyApp({ Component, pageProps }: AppProps) {
  const theme = createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  })

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

export default MyApp