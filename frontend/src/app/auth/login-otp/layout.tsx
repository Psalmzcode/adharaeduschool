import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in with email code — AdharaEdu',
  description: 'Enter the one-time code sent to your email to access your portal.',
}

export default function LoginOtpLayout({ children }: { children: React.ReactNode }) {
  return children
}
