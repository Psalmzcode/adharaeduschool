import toast from 'react-hot-toast'

function errMessage(e: unknown, fallback: string) {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: string }).message === 'string') {
    return (e as { message: string }).message
  }
  return fallback
}

/**
 * App-wide toasts (replaces window.alert). Use success / error / warning / info.
 */
export const notify = {
  success: (message: string) => toast.success(message, { duration: 3800 }),
  error: (message: string) => toast.error(message, { duration: 5200 }),
  /** Validation, “fix this” — amber feel */
  warning: (message: string) =>
    toast(message, {
      icon: '⚠️',
      duration: 4500,
      style: { borderColor: 'rgba(245, 158, 11, 0.4)' },
    }),
  info: (message: string) => toast(message, { icon: 'ℹ️', duration: 3800 }),
  /** From caught API errors */
  fromError: (e: unknown, fallback = 'Something went wrong') => toast.error(errMessage(e, fallback), { duration: 5200 }),
}
