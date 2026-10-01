'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Activity as ActivityIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { effortKm } from '@/lib/garmin'
import { formatClock, formatNumber, formatPace, formatShortDate } from '@/lib/format'
import type { TrainingSummary as Summary } from '@/lib/projection'

const chartConfig = {
  km: { label: 'Jarak (km)', color: 'var(--chart-2)' },
} satisfies ChartConfig

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

export function TrainingSummary({ summary }: { summary: Summary | null }) {
  if (!summary) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
          <ActivityIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Belum ada data latihan</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Muat naik CSV Garmin anda atau cuba data contoh untuk melihat analisis latihan.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Ringkasan Latihan</CardTitle>
        <CardDescription>16 minggu sehingga {formatShortDate(summary.windowEnd)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Km / minggu" value={formatNumber(summary.weeklyKmAvg, 1)} hint="purata 8 minggu" />
          <Stat label="D+ / minggu" value={`${formatNumber(summary.weeklyAscentAvg)} m`} hint="purata 8 minggu" />
          <Stat
            label="Terpanjang"
            value={`${formatNumber(summary.longestEffortKm, 1)}`}
            hint="km-effort, 12 minggu"
          />
          <Stat
            label="Marathon setara"
            value={formatClock(summary.marathonEquivalentSec)}
            hint="jalan rata"
          />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Jarak mingguan (km)</h3>
          <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
            <BarChart data={summary.weekly} margin={{ left: -16, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="km" fill="var(--color-km)" radius={3} />
            </BarChart>
          </ChartContainer>
        </div>

        {summary.basisRuns.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Larian rujukan untuk anggaran kecergasan
            </h3>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {summary.basisRuns.map(({ activity, predictedSec }) => (
                <li
                  key={`${activity.date.getTime()}-${activity.title}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{activity.title || activity.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(activity.date)} · {formatNumber(activity.distanceKm, 1)} km ·{' '}
                      {formatClock(activity.durationSec)} · {formatPace(activity.durationSec / activity.distanceKm)}
                      {activity.ascentM > 0 ? ` · ${formatNumber(activity.ascentM)} m D+` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm tabular-nums">{formatClock(predictedSec)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatNumber(effortKm(activity), 1)} km-effort
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
