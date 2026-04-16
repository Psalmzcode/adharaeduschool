import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email verification — AdharaEdu',
  description: 'Enter the code sent to your email (used when your sign-in flow requests a verification code).',
}

export default function OtpDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
