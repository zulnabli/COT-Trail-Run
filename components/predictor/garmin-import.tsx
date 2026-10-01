'use client'

import { useId, useState } from 'react'
import { FileSpreadsheet, LoaderCircle, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SegmentedControl } from './segmented-control'
import type { DistanceUnit } from '@/lib/garmin'
import { readFileAsText } from '@/lib/read-file'
import { CLOUD_SYNC_ENABLED } from '@/lib/config'
import { cn } from '@/lib/utils'

type Props = {
  sourceLabel: string | null
  activityCount: number
  skipped: number
  error: string | null
  syncStatus: 'local' | 'loading' | 'saving' | 'saved' | 'error'
  unit: DistanceUnit
  onUnitChange: (unit: DistanceUnit) => void
  onFile: (text: string, fileName: string) => void
  onSample: () => void
  onClear: () => void
}

export function GarminImport({
  sourceLabel,
  activityCount,
  skipped,
  error,
  syncStatus,
  unit,
  onUnitChange,
  onFile,
  onSample,
  onClear,
}: Props) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [readingFile, setReadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const syncMessage = {
    local: CLOUD_SYNC_ENABLED
      ? 'Log masuk Google untuk sync data antara peranti.'
      : 'Mod tempatan: data dikongsi melalui server ini pada rangkaian yang sama.',
    loading: 'Memuat data akaun…',
    saving: CLOUD_SYNC_ENABLED ? 'Menyimpan data ke VPS…' : 'Menyimpan pada server tempatan…',
    saved: CLOUD_SYNC_ENABLED
      ? 'Data akaun disimpan dan boleh dibuka pada peranti lain.'
      : 'Data disimpan pada server tempatan dan boleh dibuka melalui IP LAN.',
    error: 'Sync gagal. Data masih tersedia pada browser ini.',
  }[syncStatus]

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setReadingFile(true)
    setFileError(null)
    try {
      onFile(await readFileAsText(file), file.name)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Gagal membaca fail CSV.')
    } finally {
      setReadingFile(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            1
          </span>
          Data Garmin
        </CardTitle>
        <CardDescription>
          Muat naik fail <span className="font-mono text-foreground">Activities.csv</span> dari Garmin Connect.
          {CLOUD_SYNC_ENABLED
            ? ' Data diproses dalam browser; log masuk Google untuk sync ke akaun VPS anda.'
            : ' Data dikongsi melalui server dev pada localhost dan IP LAN. Guna rangkaian dipercayai sahaja.'}
        </CardDescription>
        <p aria-live="polite" className="flex items-center gap-2 px-(--card-spacing) text-xs text-muted-foreground">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              syncStatus === 'saved' && 'bg-success',
              syncStatus === 'saving' && 'animate-pulse bg-primary',
              syncStatus === 'error' && 'bg-destructive',
              (syncStatus === 'local' || syncStatus === 'loading') && 'bg-muted-foreground',
            )}
            aria-hidden="true"
          />
          {syncMessage}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-8',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 hover:bg-muted/50',
          )}
        >
          {readingFile ? (
            <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-sm font-medium">{readingFile ? 'Sedang membaca CSV…' : 'Pilih fail CSV atau seret ke sini'}</span>
          <span className="text-xs text-muted-foreground">Disyorkan: aktiviti 16 minggu terakhir</span>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            aria-label="Pilih fail CSV Garmin"
            className="mt-1 block w-full max-w-sm cursor-pointer text-left text-xs file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-primary file:px-3 file:font-medium file:text-primary-foreground file:hover:bg-primary/90"
            onChange={(e) => {
              void handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Unit dalam CSV</span>
            <SegmentedControl
              label="Unit jarak dalam CSV"
              value={unit}
              onChange={onUnitChange}
              options={[
                { value: 'km', label: 'km / m' },
                { value: 'mi', label: 'batu / kaki' },
              ]}
            />
          </div>
          <Button variant="outline" size="sm" onClick={onSample}>
            <Sparkles data-icon="inline-start" />
            Guna data contoh
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {fileError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {fileError}
          </p>
        )}

        {sourceLabel && !error && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-success/10 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 shrink-0 text-success" aria-hidden="true" />
              <span className="truncate font-medium">{sourceLabel}</span>
              <span className="shrink-0 text-muted-foreground">
                {activityCount} aktiviti{skipped > 0 ? ` · ${skipped} diabaikan` : ''}
              </span>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Buang data">
              <X />
            </Button>
          </div>
        )}

        <details className="group rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium marker:text-muted-foreground">
            Cara eksport dari Garmin Connect
          </summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
            <li>Log masuk ke connect.garmin.com di komputer.</li>
            <li>
              Pergi ke <span className="text-foreground">Activities → All Activities</span>.
            </li>
            <li>Skrol ke bawah sehingga aktiviti ~16 minggu terakhir dimuatkan.</li>
            <li>
              Klik <span className="text-foreground">Export CSV</span> di penjuru kanan atas.
            </li>
            <li>Muat naik fail Activities.csv di sini.</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  )
}
