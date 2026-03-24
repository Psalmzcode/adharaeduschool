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
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
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
