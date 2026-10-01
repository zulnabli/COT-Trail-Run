'use client'

import { LogIn, LogOut } from 'lucide-react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { CLOUD_SYNC_ENABLED } from '@/lib/config'

export function AccountControl() {
  if (!CLOUD_SYNC_ENABLED) {
    return <span className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">Mod tempatan</span>
  }

  return <GoogleAccountControl />
}

function GoogleAccountControl() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <span className="h-8 w-20 animate-pulse rounded-md bg-muted" aria-label="Memuatkan akaun" />
  }

  if (!session?.user) {
    return (
      <Button size="sm" variant="outline" onClick={() => signIn('google')}>
        <LogIn data-icon="inline-start" />
        Log masuk
      </Button>
    )
  }

  return (
    <div className="flex max-w-48 items-center gap-2">
      <span className="hidden truncate text-xs text-muted-foreground sm:block">{session.user.email}</span>
      <Button size="icon-sm" variant="outline" aria-label="Log keluar" title="Log keluar" onClick={() => signOut()}>
        <LogOut />
      </Button>
    </div>
  )
}