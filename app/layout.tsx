export const metadata = {
  title: 'SWT CRM',
  description: 'CRM for Shajanand World Travels',
};

import React from 'react';
import ThemeProviderClient from './ThemeProviderClient';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProviderClient>{children}</ThemeProviderClient>
      </body>
    </html>
  );
}
