import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme'
import { AppQueryProvider } from '@/lib/query-provider'
import { AppToaster } from '@/components/AppToaster'

export const metadata: Metadata = {
  title: 'AdharaEdu — Tech Skills for Tomorrow',
  description: 'AdharaEdu partners with secondary schools to deliver structured tech education.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body suppressHydrationWarning={true}>
        <AppQueryProvider>
          <ThemeProvider>
            {children}
            <AppToaster />
          </ThemeProvider>
        </AppQueryProvider>
      </body>
    </html>
  )
}
