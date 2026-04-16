import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — AdharaEdu',
  description: 'Why AdharaEdu exists, our mission, and the team behind tech skills for Nigerian schools.',
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
