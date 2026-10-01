import { Mountain } from 'lucide-react'
import { headers } from 'next/headers'
import { networkInterfaces } from 'node:os'
import { RacePredictor } from '@/components/predictor/race-predictor'
import { AccountControl } from '@/components/auth/account-control'
import { CLOUD_SYNC_ENABLED } from '@/lib/config'

function getLanAddress(): string | null {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
  return (
    addresses.find((address) => address.startsWith('192.168.')) ??
    addresses.find((address) => address.startsWith('10.')) ??
    addresses.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address)) ??
    null
  )
}

export default async function Page() {
  let lanOrigin: string | null = null
  if (process.env.NODE_ENV === 'development' && !CLOUD_SYNC_ENABLED) {
    const host = (await headers()).get('host') ?? ''
    const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.exec(host)
    const lanAddress = localHost ? getLanAddress() : null
    if (localHost && lanAddress) {
      const port = localHost[2] ?? ':3000'
      lanOrigin = `http://${lanAddress}${port}`
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
              <Mountain className="size-4" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">LepasCOT</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:block">Ultra Trail & Marathon Predictor</span>
            <AccountControl />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex max-w-3xl flex-col gap-2.5">
          <p className="text-xs font-semibold tracking-normal text-primary uppercase">Race Projection</p>
          <h1 className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
            Boleh lepas cut-off atau tidak? Tengok data Garmin anda.
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty sm:text-base">
            Import aktiviti dari Garmin Connect, pilih race ultra trail atau marathon, dan dapatkan anggaran masa
            tamat, peluang lepas COT di setiap checkpoint, serta cadangan latihan.
          </p>
        </div>
        <RacePredictor lanOrigin={lanOrigin} />
      </main>
    </div>
  )
}
