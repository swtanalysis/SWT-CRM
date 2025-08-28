"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from '../lib/theme';

const ThemeProviderClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try { const stored = localStorage.getItem('pref_theme'); if (stored === 'dark' || stored === 'light') return stored as any; } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      try { const stored = localStorage.getItem('pref_theme'); if (stored === 'dark' || stored === 'light') return; } catch {}
      setMode(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    const custom = (e: any) => { const t = e?.detail?.theme; if (t === 'dark' || t === 'light') setMode(t); };
    window.addEventListener('user-theme-change', custom as any);
    return () => { mq.removeEventListener('change', handler); window.removeEventListener('user-theme-change', custom as any); };
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderClient;
