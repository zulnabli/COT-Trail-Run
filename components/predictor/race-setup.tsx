'use client'

import { useId, useState } from 'react'
import { LoaderCircle, Map as MapIcon, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NumberField, TimeField } from './fields'
import { SegmentedControl } from './segmented-control'
import { parseGpx } from '@/lib/gpx'
import { formatNumber } from '@/lib/format'
import { readFileAsText } from '@/lib/read-file'
import { PRESETS } from '@/lib/presets'
import { TERRAIN_OPTIONS, WEATHER_OPTIONS, type Checkpoint, type RaceConfig, type RaceType } from '@/lib/projection'
import { cn } from '@/lib/utils'

type Props = {
  race: RaceConfig
  activePresetId: string | null
  savedEvents: { id: string; race: RaceConfig }[]
  selectedEventId: string | null
  isSelectedEventCurrent: boolean
  onSaveNewEvent: () => void
  onUpdateSelectedEvent: () => void
  onSelectEvent: (id: string) => void
  onDeleteEvent: (id: string) => void
  onChange: (race: RaceConfig) => void
  onPreset: (presetId: string, race: RaceConfig) => void
}

export function RaceSetup({
  race,
  activePresetId,
  savedEvents,
  selectedEventId,
  isSelectedEventCurrent,
  onSaveNewEvent,
  onUpdateSelectedEvent,
  onSelectEvent,
  onDeleteEvent,
  onChange,
  onPreset,
}: Props) {
  const gpxInputId = useId()
  const nameId = useId()
  const raceDateId = useId()
  const distanceId = useId()
  const gainId = useId()
  const cutoffId = useId()
  const stopId = useId()
  const [gpxError, setGpxError] = useState<string | null>(null)
  const [readingGpx, setReadingGpx] = useState(false)

  const update = (patch: Partial<RaceConfig>) => onChange({ ...race, ...patch })

  const updateCheckpoint = (id: string, patch: Partial<Checkpoint>) =>
    update({ checkpoints: race.checkpoints.map((cp) => (cp.id === id ? { ...cp, ...patch } : cp)) })

  const addCheckpoint = () => {
    const lastKm = race.checkpoints.reduce((max, cp) => Math.max(max, cp.km || 0), 0)
    const nextKm = Math.min(Math.round(lastKm + race.distanceKm / 4), Math.floor(race.distanceKm - 1))
    update({
      checkpoints: [
        ...race.checkpoints,
        { id: crypto.randomUUID(), name: `CP${race.checkpoints.length + 1}`, km: nextKm, cutoffSec: null },
      ],
    })
  }

  const handleGpx = async (file: File | undefined) => {
    if (!file) return
    setReadingGpx(true)
    setGpxError(null)
    try {
      const course = parseGpx(await readFileAsText(file), file.name.replace(/\.gpx$/i, ''))
      update({
        course,
        name: course.name,
        distanceKm: course.distanceKm,
        gainM: course.gainM > 0 ? course.gainM : race.gainM,
      })
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : 'Gagal membaca fail GPX.')
    } finally {
      setReadingGpx(false)
    }
  }

  const switchType = (type: RaceType) => {
    const preset = PRESETS[type][0]
    onPreset(preset.id, preset.config)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            2
          </span>
          Butiran Race
        </CardTitle>
        <CardDescription>Pilih jenis race, masukkan jarak, elevation dan cut-off time (COT).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs value={race.type} onValueChange={(v) => switchType(v as RaceType)}>
          <TabsList className="w-full">
            <TabsTrigger value="ultra">Ultra Trail</TabsTrigger>
            <TabsTrigger value="marathon">Marathon</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-1.5" aria-label="Pratetap race">
          {PRESETS[race.type].map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant={activePresetId === preset.id ? 'secondary' : 'outline'}
              aria-pressed={activePresetId === preset.id}
              onClick={() => onPreset(preset.id, preset.config)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-y border-border py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Event tersimpan</p>
              <p className="text-xs text-muted-foreground">
                {savedEvents.length} event · disimpan dalam browser ini
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onSaveNewEvent}>
              <Save data-icon="inline-start" />
              Simpan event baharu
            </Button>
          </div>

          {savedEvents.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {savedEvents.map((event) => (
                <li key={event.id} className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    aria-pressed={selectedEventId === event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col items-start rounded-sm px-2 py-1 text-left hover:bg-muted',
                      selectedEventId === event.id && 'bg-muted',
                    )}
                  >
                    <span className="w-full truncate text-sm font-medium">
                      {event.race.name || 'Race tanpa nama'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(event.race.distanceKm, 1)} km · {formatNumber(event.race.gainM)} m D+ ·{' '}
                      {event.race.course ? 'GPX' : 'Tanpa GPX'}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Padam ${event.race.name || 'race tersimpan'}`}
                    title="Padam event"
                    onClick={() => onDeleteEvent(event.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {selectedEventId && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {isSelectedEventCurrent ? 'Tiada perubahan belum disimpan' : 'Ada perubahan belum disimpan'}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={onUpdateSelectedEvent}
                disabled={isSelectedEventCurrent}
              >
                Kemas kini event dipilih
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Nama race</Label>
            <Input id={nameId} value={race.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={raceDateId}>Tarikh race</Label>
            <Input
              id={raceDateId}
              type="date"
              value={race.raceDate ?? ''}
              onChange={(e) => update({ raceDate: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={distanceId}>Jarak (km)</Label>
            <NumberField id={distanceId} value={race.distanceKm} onChange={(v) => update({ distanceKm: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={gainId}>D+ (m)</Label>
            <NumberField id={gainId} value={race.gainM} step="10" onChange={(v) => update({ gainM: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={cutoffId}>COT (jj:mm)</Label>
            <TimeField id={cutoffId} value={race.cutoffSec} onChange={(v) => update({ cutoffSec: v ?? 0 })} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Terrain</span>
          <SegmentedControl
            label="Terrain"
            value={race.terrain}
            onChange={(terrain) => update({ terrain })}
            options={TERRAIN_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Cuaca</span>
          <SegmentedControl
            label="Cuaca"
            value={race.weather}
            onChange={(weather) => update({ weather })}
            options={WEATHER_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Laluan GPX (pilihan)</p>
              <p className="text-xs text-muted-foreground">Kira jarak, D+ dan profil elevation secara automatik.</p>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:items-end">
              <label htmlFor={gpxInputId} className="text-xs font-medium">
                {readingGpx ? 'Sedang membaca GPX…' : 'Pilih fail GPX'}
              </label>
              <input
                id={gpxInputId}
                type="file"
                accept=".gpx,application/gpx+xml"
                aria-label="Pilih fail laluan GPX"
                className="block w-full max-w-sm cursor-pointer text-left text-xs file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-primary file:px-3 file:font-medium file:text-primary-foreground file:hover:bg-primary/90"
                onChange={(e) => {
                  void handleGpx(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </div>
          {gpxError && (
            <p role="alert" className="text-xs text-destructive">
              {gpxError}
            </p>
          )}
          {race.course && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-1.5 text-xs">
              <span className="truncate">
                <span className="font-medium">{race.course.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatNumber(race.course.distanceKm, 1)} km · {formatNumber(race.course.gainM)} m D+
                </span>
              </span>
              <Button variant="ghost" size="icon-xs" aria-label="Buang laluan GPX" onClick={() => update({ course: null })}>
                <X />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Checkpoint & COT</p>
              <p className="text-xs text-muted-foreground">Masa dari mula race (jj:mm)</p>
            </div>
            <Button variant="outline" size="sm" onClick={addCheckpoint}>
              <Plus data-icon="inline-start" />
              Tambah CP
            </Button>
          </div>

          {race.checkpoints.length > 0 && (
            <div className="flex flex-col gap-2 overflow-x-auto">
              <div className="grid min-w-[25rem] grid-cols-[1fr_4.5rem_5rem_1.75rem] gap-2 px-0.5 text-[11px] font-medium text-muted-foreground">
                <span>Nama</span>
                <span>Km</span>
                <span>COT</span>
                <span className="sr-only">Tindakan</span>
              </div>
              {race.checkpoints.map((cp) => (
                <div key={cp.id} className="grid min-w-[25rem] grid-cols-[1fr_4.5rem_5rem_1.75rem] items-center gap-2">
                  <Input
                    aria-label="Nama checkpoint"
                    value={cp.name}
                    onChange={(e) => updateCheckpoint(cp.id, { name: e.target.value })}
                  />
                  <NumberField
                    aria-label={`Kilometer ${cp.name}`}
                    value={cp.km}
                    onChange={(km) => updateCheckpoint(cp.id, { km })}
                    className={cn(cp.km >= race.distanceKm && 'border-destructive')}
                  />
                  <TimeField
                    aria-label={`COT ${cp.name}`}
                    value={cp.cutoffSec}
                    onChange={(cutoffSec) => updateCheckpoint(cp.id, { cutoffSec })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Buang ${cp.name}`}
                    onClick={() => update({ checkpoints: race.checkpoints.filter((c) => c.id !== cp.id) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {race.checkpoints.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={stopId} className="text-xs font-normal text-muted-foreground">
                Masa berhenti di setiap CP (minit)
              </Label>
              <NumberField
                id={stopId}
                value={race.stopMinPerCp}
                step="1"
                onChange={(v) => update({ stopMinPerCp: v })}
                className="w-20"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
