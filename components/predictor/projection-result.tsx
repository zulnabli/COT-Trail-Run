'use client'

import { AlertTriangle, CheckCircle2, Flag, Lightbulb, Printer, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ElevationChart } from './elevation-chart'
import { PrintReport } from './print-report'
import { formatClock, formatHM, formatNumber, formatPace, formatShortDate } from '@/lib/format'
import type { Projection, RaceConfig, TrainingSummary, Verdict } from '@/lib/projection'
import { cn } from '@/lib/utils'

const trainingChartConfig = {
  weeklyKm: { label: 'Jarak mingguan (km)', color: 'var(--chart-2)' },
  longEffort: { label: 'Long run (km-effort)', color: 'var(--chart-4)' },
} satisfies ChartConfig

const elevationChartConfig = {
  ascentM: { label: 'D+ sasaran mingguan (m)', color: 'var(--chart-3)' },
} satisfies ChartConfig

const VERDICT_STYLE: Record<
  Verdict,
  { title: string; subtitle: string; icon: typeof CheckCircle2; className: string; bar: string }
> = {
  likely: {
    title: 'Boleh Lepas',
    subtitle: 'Berdasarkan latihan semasa, anda dijangka habis dalam COT.',
    icon: CheckCircle2,
    className: 'bg-success text-success-foreground',
    bar: 'bg-success',
  },
  borderline: {
    title: 'Cukup-Cukup',
    subtitle: 'Peluang ada, tetapi margin tipis. Sedikit masalah boleh menyebabkan DNF.',
    icon: AlertTriangle,
    className: 'bg-warning text-warning-foreground',
    bar: 'bg-warning',
  },
  unlikely: {
    title: 'Sukar Lepas COT',
    subtitle: 'Dengan tahap latihan sekarang, risiko tidak lepas cut-off adalah tinggi.',
    icon: XCircle,
    className: 'bg-destructive text-white',
    bar: 'bg-destructive',
  },
}

export function ProjectionResult({
  projection,
  race,
  summary,
}: {
  projection: Projection | null
  race: RaceConfig
  summary: TrainingSummary | null
}) {
  if (!projection || !summary) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-80 flex-col items-center justify-center gap-3 text-center">
          <Flag className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium text-balance">Projection akan dipaparkan di sini</p>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Muat naik data Garmin (sekurang-kurangnya satu larian 5 km ke atas) dan lengkapkan butiran race.
          </p>
        </CardContent>
      </Card>
    )
  }

  const style = VERDICT_STYLE[projection.verdict]
  const Icon = style.icon
  const probabilityPct = Math.round(projection.probability * 100)
  const finish = projection.checkpoints[projection.checkpoints.length - 1]
  const calendar = projection.trainingPlan.calendar
  const calendarStatusMessage = {
    ready: '',
    'missing-date': 'Masukkan tarikh race dalam Butiran Race untuk jana kalendar.',
    'invalid-date': 'Tarikh race tidak sah. Pilih tarikh melalui pemilih tarikh.',
    'race-before-training': 'Tarikh race mesti selepas tarikh aktiviti Garmin terakhir.',
    'too-far': 'Kalendar latihan dijana sehingga 52 minggu dari aktiviti terakhir.',
  }[calendar.status]
  const calendarChartData = calendar.weeks.map((week) => ({
    week: `M${week.number}`,
    weeklyKm: Math.round(week.weeklyKmTarget * 10) / 10,
    longEffort: Math.round(week.longEffortTargetKm * 10) / 10,
    ascentM: week.weeklyAscentTargetM ?? 0,
  }))
  const needsFaster =
    projection.requiredMarathonSec != null && projection.requiredMarathonSec < projection.currentMarathonSec

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex justify-end print:hidden">
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Jana & cetak laporan
        </Button>
      </div>

      <PrintReport projection={projection} race={race} summary={summary} />

      <Card className="overflow-hidden py-0">
        <div className={cn('flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between', style.className)}>
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium tracking-wide uppercase opacity-80">{race.name || 'Race anda'}</p>
              <h2 className="text-2xl font-semibold tracking-tight">{style.title}</h2>
              <p className="mt-1 max-w-md text-sm opacity-90 text-pretty">{style.subtitle}</p>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="font-mono text-4xl font-semibold tabular-nums">{probabilityPct}%</p>
            <p className="text-xs opacity-80">peluang lepas COT</p>
          </div>
        </div>
        <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Masa dijangka</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{formatClock(projection.predictedSec)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatHM(projection.rangeLowSec)} – {formatHM(projection.rangeHighSec)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">COT</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{formatClock(race.cutoffSec)}</p>
            <p
              className={cn(
                'text-[11px]',
                finish.marginSec != null && finish.marginSec < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {finish.marginSec != null
                ? finish.marginSec >= 0
                  ? `Buffer ${formatHM(finish.marginSec)}`
                  : `Lewat ${formatHM(-finish.marginSec)}`
                : 'Tiada COT'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Purata pace</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{formatPace(projection.avgPaceSec)}</p>
            <p className="text-[11px] text-muted-foreground">termasuk berhenti</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jarak effort</p>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {formatNumber(projection.raceEffortKm, 1)}
            </p>
            <p className="text-[11px] text-muted-foreground">km + D+/100</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pelan Checkpoint</CardTitle>
          <CardDescription>Anggaran masa tiba berbanding cut-off di setiap CP.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {race.course && (
            <ElevationChart
              course={race.course}
              markers={projection.checkpoints.map((c) => ({
                km: c.km,
                name: c.isFinish ? 'Finish' : c.name,
                late: c.marginSec != null && c.marginSec < 0,
              }))}
            />
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">CP</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Km</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Segmen</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tiba</th>
                  <th scope="col" className="py-2 pr-3 font-medium">COT</th>
                  <th scope="col" className="py-2 text-right font-medium">Buffer</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {projection.checkpoints.map((cp) => {
                  const late = cp.marginSec != null && cp.marginSec < 0
                  const tight = cp.probability != null && cp.probability < 0.75 && !late
                  return (
                    <tr key={cp.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-sans font-medium">
                        {cp.name}
                      </th>
                      <td className="py-2 pr-3">{formatNumber(cp.km, 1)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatNumber(cp.segmentKm, 1)} km · {formatHM(cp.segmentSec)}
                      </td>
                      <td className="py-2 pr-3">{formatClock(cp.arrivalSec)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {cp.cutoffSec ? formatClock(cp.cutoffSec) : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {cp.marginSec == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-mono',
                              late && 'border-destructive/40 bg-destructive/10 text-destructive',
                              tight && 'border-warning/50 bg-warning/15 text-warning-foreground',
                              !late && !tight && 'border-success/40 bg-success/10 text-success',
                            )}
                          >
                            {late ? `-${formatHM(-cp.marginSec)}` : `+${formatHM(cp.marginSec)}`}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kesediaan Latihan</CardTitle>
            <CardDescription>Berbanding keperluan minimum race ini.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {projection.readinessItems.map((item) => {
              const pct = Math.min(100, Math.round((item.actual / item.required) * 100))
              const barClass = pct >= 85 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive'
              return (
                <div key={item.key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{item.label}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatNumber(item.actual, item.unit === 'm' ? 0 : 1)} / {formatNumber(item.required)}{' '}
                      {item.unit}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={item.label}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={cn('h-full rounded-full', barClass)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="mt-1 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {projection.factors.map((f) => (
                <div key={f.label} className="flex justify-between">
                  <span>Faktor {f.label.toLowerCase()}</span>
                  <span className="font-mono tabular-nums">
                    {f.multiplier > 1 ? `+${Math.round((f.multiplier - 1) * 100)}%` : '0%'}
                  </span>
                </div>
              ))}
              {projection.requiredMarathonSec != null && projection.requiredMarathonSec > 0 && (
                <p className={cn('mt-2 text-pretty', needsFaster ? 'text-foreground' : '')}>
                  Untuk habis selesa (90% COT), anda perlukan kecergasan setara marathon{' '}
                  <span className="font-mono font-medium text-foreground">
                    {formatClock(projection.requiredMarathonSec)}
                  </span>{' '}
                  — sekarang <span className="font-mono">{formatClock(projection.currentMarathonSec)}</span>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-primary" aria-hidden="true" />
              Cadangan
            </CardTitle>
            <CardDescription>Langkah untuk tingkatkan peluang lepas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {projection.recommendations.map((rec) => (
                <li key={rec} className="flex gap-2.5 text-pretty">
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', style.bar)} aria-hidden="true" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pelan latihan untuk lepas COT</CardTitle>
          <CardDescription>
            Template mingguan berdasarkan latihan semasa. Sasaran jarak naik beransur, maksimum 10% daripada purata
            semasa; tiada tarikh race untuk kira countdown atau taper khusus.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section>
            <div className="grid grid-cols-2 gap-4 border-y border-border py-3">
              <div>
                <p className="text-xs text-muted-foreground">Sasaran jarak minggu depan</p>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  {formatNumber(projection.trainingPlan.weeklyKmTarget, 1)} km
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Long run sasaran</p>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  {formatNumber(projection.trainingPlan.longEffortTargetKm, 1)} km-effort
                </p>
              </div>
            </div>
            <h3 className="mb-1 mt-4 text-sm font-medium">Contoh minggu latihan</h3>
            <ul className="flex flex-col divide-y divide-border">
              {projection.trainingPlan.sessions.map((session) => (
                <li key={session.day} className="grid grid-cols-[4.5rem_1fr] gap-2 py-2">
                  <span className="text-xs font-medium text-muted-foreground">{session.day}</span>
                  <div>
                    <p className="text-sm font-medium">{session.title}</p>
                    <p className="text-xs text-muted-foreground">{session.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-2 text-sm font-medium">Latihan kekuatan · 2 kali seminggu</h3>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {projection.trainingPlan.strengthSessions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-medium">Strategi hari race</h3>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {projection.trainingPlan.raceStrategy.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Mulakan latihan beban dengan teknik dan beban ringan. Hentikan jika sakit tajam; dapatkan nasihat
              jurulatih atau profesional kesihatan jika ada kecederaan.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kalendar latihan hingga race</CardTitle>
          <CardDescription>
            Bermula sehari selepas aktiviti Garmin terakhir. Pelan menggunakan minggu bina, pemulihan dan taper; laraskan
            hari sesi mengikut jadual serta keadaan badan. Sasaran km harian dijumlahkan mengikut minggu; D+ lebih tertumpu
            pada long run dan sesi bukit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calendar.status !== 'ready' ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              {calendarStatusMessage}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                <p className="text-sm">
                  Latihan terakhir <span className="font-medium text-foreground">{formatShortDate(calendar.lastTrainingDate)}</span>
                </p>
                <p className="text-sm">
                  Hari race <span className="font-medium text-foreground">{formatShortDate(calendar.raceDate!)}</span>
                </p>
              </div>

              <section aria-label="Graf sasaran latihan mingguan">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Beban latihan beransur</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-2)' }} aria-hidden="true" />
                      Jarak mingguan
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-4)' }} aria-hidden="true" />
                      Long run (km-effort)
                    </span>
                  </div>
                </div>
                <ChartContainer config={trainingChartConfig} className="h-52 w-full">
                  <BarChart data={calendarChartData} margin={{ left: -18, right: 8, top: 6 }} barGap={4}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.ceil(calendar.weeks.length / 8) - 1)}
                      fontSize={11}
                    />
                    <YAxis tickLine={false} axisLine={false} width={38} fontSize={11} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="weeklyKm" fill="var(--color-weeklyKm)" radius={3} />
                    <Bar dataKey="longEffort" fill="var(--color-longEffort)" radius={3} />
                  </BarChart>
                </ChartContainer>
              </section>

              {calendar.weeks.some((week) => week.weeklyAscentTargetM !== null) && (
                <section aria-label="Graf sasaran elevation mingguan" className="border-t border-border pt-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium">Sasaran elevation mingguan</h3>
                    <span className="text-xs text-muted-foreground">
                      Purata semasa {formatNumber(projection.readinessItems.find((item) => item.key === 'vert')?.actual ?? 0)} m D+
                    </span>
                  </div>
                  <ChartContainer config={elevationChartConfig} className="h-36 w-full">
                    <BarChart data={calendarChartData} margin={{ left: -18, right: 8, top: 6 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="week"
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(0, Math.ceil(calendar.weeks.length / 8) - 1)}
                        fontSize={11}
                      />
                      <YAxis tickLine={false} axisLine={false} width={42} fontSize={11} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="ascentM" fill="var(--color-ascentM)" radius={3} />
                    </BarChart>
                  </ChartContainer>
                </section>
              )}

              <div className="flex flex-col divide-y divide-border border-y border-border">
                {calendar.weeks.map((week) => (
                  <details key={week.number} open={week.number === 1}>
                    <summary className="grid cursor-pointer list-none gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        Minggu {week.number}
                        <Badge variant="outline">{week.phase}</Badge>
                      </span>
                      <span className="text-xs text-muted-foreground sm:text-right">
                        {formatShortDate(week.days[0].date)} hingga {formatShortDate(week.days[week.days.length - 1].date)}
                        {' · '}{formatNumber(week.weeklyKmTarget, 1)} km latihan
                        {week.weeklyAscentTargetM !== null && ` · ${formatNumber(week.weeklyAscentTargetM)} m D+`}
                        {week.longRunKm > 0 && ` · long ${formatNumber(week.longRunKm, 1)} km`}
                      </span>
                    </summary>
                    <ol className="mb-2 flex flex-col divide-y divide-border rounded-md bg-muted/30 px-3">
                      {week.days.map((day) => (
                        <li key={day.date.toISOString()} className="grid gap-1 py-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3">
                          <time dateTime={day.date.toISOString().slice(0, 10)} className="text-xs font-medium text-muted-foreground">
                            {new Intl.DateTimeFormat('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' }).format(day.date)}
                          </time>
                          <div>
                            <p className="text-sm font-medium">{day.title}</p>
                            <p className="text-xs text-muted-foreground">{day.detail}</p>
                            {(day.distanceKm !== null || day.ascentTargetM !== null) && (
                              <p className="mt-1 font-mono text-xs font-medium tabular-nums text-foreground">
                                {day.distanceKm !== null && `${formatNumber(day.distanceKm, 1)} km`}
                                {day.distanceKm !== null && day.ascentTargetM !== null && ' · '}
                                {day.ascentTargetM !== null && `${formatNumber(day.ascentTargetM)} m D+`}
                                {day.title === 'Hari race' && ' · race'}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-pretty">
        Anggaran berdasarkan formula Riegel dengan jarak effort (km + D+/100), faktor keletihan ultra, terrain,
        cuaca dan volum latihan. Ia bukan jaminan — faktor seperti tidur, pemakanan, kecederaan dan navigasi
        turut mempengaruhi keputusan sebenar.
      </p>
    </div>
  )
}
