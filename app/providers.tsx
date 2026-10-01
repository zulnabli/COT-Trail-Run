'use client'

import { SessionProvider } from 'next-auth/react'
import { CLOUD_SYNC_ENABLED } from '@/lib/config'

export function Providers({ children }: { children: React.ReactNode }) {
  if (!CLOUD_SYNC_ENABLED) return <>{children}</>
  return <SessionProvider>{children}</SessionProvider>
}