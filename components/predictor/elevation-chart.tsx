'use client'

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { CourseProfile } from '@/lib/gpx'

const chartConfig = {
  ele: { label: 'Ketinggian (m)', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function ElevationChart({
  course,
  markers,
}: {
  course: CourseProfile
  markers: { km: number; name: string; late: boolean }[]
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <AreaChart data={course.points} margin={{ left: -12, right: 8, top: 16 }}>
        <defs>
          <linearGradient id="ele-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ele)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-ele)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="km"
          type="number"
          domain={[0, 'dataMax']}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v: number) => `${Math.round(v)}km`}
        />
        <YAxis
          dataKey="ele"
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={11}
          domain={['dataMin - 40', 'dataMax + 40']}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const km = payload?.[0]?.payload?.km
                return typeof km === 'number' ? `Km ${km.toFixed(1)}` : ''
              }}
            />
          }
        />
        <Area dataKey="ele" type="monotone" stroke="var(--color-ele)" strokeWidth={1.5} fill="url(#ele-fill)" />
        {markers.map((m) => (
          <ReferenceLine
            key={`${m.name}-${m.km}`}
            x={(m.km * course.distanceKm) / (markers[markers.length - 1]?.km || course.distanceKm)}
            stroke={m.late ? 'var(--destructive)' : 'var(--primary)'}
            strokeDasharray="3 3"
            label={{ value: m.name, position: 'top', fontSize: 10, fill: 'var(--muted-foreground)' }}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}
