export const metadata = {
  title: 'SWT CRM',
  description: 'CRM for Shajanand World Travels',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
