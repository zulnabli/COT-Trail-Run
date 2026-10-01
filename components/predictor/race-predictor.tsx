'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { CLOUD_SYNC_ENABLED } from '@/lib/config'
import { GarminImport } from './garmin-import'
import { ProjectionResult } from './projection-result'
import { RaceSetup } from './race-setup'
import { TrainingSummary } from './training-summary'
import { generateSampleActivities, parseGarminCsv, type Activity, type DistanceUnit } from '@/lib/garmin'
import { PRESETS } from '@/lib/presets'
import { projectRace, summarizeTraining, type RaceConfig } from '@/lib/projection'
import {
  isRaceConfig,
  isSavedRaceEvent,
  isWorkspacePayload,
  type SavedRaceEvent,
  type WorkspacePayload,
} from '@/lib/workspace'

type DataSource = { kind: 'csv'; text: string; fileName: string } | { kind: 'sample'; activities: Activity[] } | null
type PersistedImport = { version: 1; text: string; fileName: string; unit: DistanceUnit }
type PersistedRaceEvents = { version: 1; events: SavedRaceEvent[]; selectedEventId: string | null }

const DEFAULT_PRESET = PRESETS.ultra[0]
const STORAGE_KEY = 'lepas-cot:garmin-import'
const EVENTS_STORAGE_KEY = 'lepas-cot:saved-race-events'
const LEGACY_EVENT_STORAGE_KEY = 'lepas-cot:next-event'
const OWNER_STORAGE_KEY = 'lepas-cot:workspace-owner'

export function RacePredictor({ lanOrigin }: { lanOrigin: string | null }) {
  if (!CLOUD_SYNC_ENABLED) {
    return <RacePredictorWorkspace userId={null} authStatus="unauthenticated" lanOrigin={lanOrigin} />
  }

  return <AuthenticatedRacePredictor lanOrigin={lanOrigin} />
}

function AuthenticatedRacePredictor({ lanOrigin }: { lanOrigin: string | null }) {
  const { data: session, status: authStatus } = useSession()
  const userId = session?.user.id ?? null
  return <RacePredictorWorkspace userId={userId} authStatus={authStatus} lanOrigin={lanOrigin} />
}

function RacePredictorWorkspace({
  userId,
  authStatus,
  lanOrigin,
}: {
  userId: string | null
  authStatus: 'authenticated' | 'unauthenticated' | 'loading'
  lanOrigin: string | null
}) {
  const [source, setSource] = useState<DataSource>(null)
  const [unit, setUnit] = useState<DistanceUnit>('km')
  const [storageReady, setStorageReady] = useState(false)
  const [race, setRace] = useState<RaceConfig>(DEFAULT_PRESET.config)
  const [savedEvents, setSavedEvents] = useState<SavedRaceEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id)
  const [cloudReadyUserId, setCloudReadyUserId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'local' | 'loading' | 'saving' | 'saved' | 'error'>('local')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PersistedImport>
        if (
          parsed.version === 1 &&
          typeof parsed.text === 'string' &&
          typeof parsed.fileName === 'string' &&
          (parsed.unit === 'km' || parsed.unit === 'mi')
        ) {
          setSource({ kind: 'csv', text: parsed.text, fileName: parsed.fileName })
          setUnit(parsed.unit)
        }
      }
      try {
        const savedEventsText = localStorage.getItem(EVENTS_STORAGE_KEY)
        if (savedEventsText) {
          const parsedEvents = JSON.parse(savedEventsText) as Partial<PersistedRaceEvents>
          if (parsedEvents.version === 1 && Array.isArray(parsedEvents.events)) {
            const events = parsedEvents.events.filter(isSavedRaceEvent)
            setSavedEvents(events)
            const selectedEvent = events.find((event) => event.id === parsedEvents.selectedEventId)
            if (selectedEvent) {
              setRace(selectedEvent.race)
              setSelectedEventId(selectedEvent.id)
              setPresetId(null)
            }
          }
        } else {
          const legacyEventText = localStorage.getItem(LEGACY_EVENT_STORAGE_KEY)
          if (legacyEventText) {
            const legacyEvent = JSON.parse(legacyEventText) as { version?: unknown; race?: unknown }
            if (legacyEvent.version === 1 && isRaceConfig(legacyEvent.race)) {
              const migratedEvent = { id: 'migrated-next-event', race: legacyEvent.race }
              setSavedEvents([migratedEvent])
              setSelectedEventId(migratedEvent.id)
              setRace(migratedEvent.race)
              setPresetId(null)
            }
          }
        }
      } catch {
        setSavedEvents([])
        setSelectedEventId(null)
      }
    } catch {
      setSource(null)
    } finally {
      setStorageReady(true)
    }
  }, [])

  useEffect(() => {
    if (!storageReady || authStatus === 'loading') return
    const workspaceKey = CLOUD_SYNC_ENABLED ? userId : 'local'
    if (!workspaceKey) {
      setCloudReadyUserId(null)
      setSyncStatus('local')
      return
    }

    let cancelled = false
    setCloudReadyUserId(null)
    setSyncStatus('loading')

    const loadWorkspace = async () => {
      try {
        const response = await fetch('/api/workspace', { cache: 'no-store' })
        if (!response.ok) throw new Error('Gagal memuat workspace.')
        const result = (await response.json()) as { payload: unknown }
        if (cancelled) return

        const previousOwner = localStorage.getItem(OWNER_STORAGE_KEY)
        const accountChanged = CLOUD_SYNC_ENABLED && previousOwner !== null && previousOwner !== userId
        const hasLocalData = source?.kind === 'csv' || savedEvents.length > 0
        if (result.payload !== null) {
          if (!isWorkspacePayload(result.payload)) throw new Error('Workspace daripada server tidak sah.')
          const payload = result.payload
          const hasServerData = payload.garminImport !== null || payload.savedEvents.length > 0
          if (accountChanged || hasServerData || !hasLocalData) {
            setSource(
              payload.garminImport
                ? { kind: 'csv', text: payload.garminImport.text, fileName: payload.garminImport.fileName }
                : null,
            )
            setUnit(payload.garminImport?.unit ?? 'km')
            setSavedEvents(payload.savedEvents)
            setSelectedEventId(payload.selectedEventId)
            const selected = payload.savedEvents.find((event) => event.id === payload.selectedEventId)
            if (selected) {
              setRace(selected.race)
              setPresetId(null)
            } else {
              setRace(DEFAULT_PRESET.config)
              setPresetId(DEFAULT_PRESET.id)
            }
          }
        } else if (accountChanged) {
          setSource(null)
          setUnit('km')
          setSavedEvents([])
          setSelectedEventId(null)
          setRace(DEFAULT_PRESET.config)
          setPresetId(DEFAULT_PRESET.id)
        }

        if (CLOUD_SYNC_ENABLED && userId) localStorage.setItem(OWNER_STORAGE_KEY, userId)
        setCloudReadyUserId(workspaceKey)
        setSyncStatus('saving')
      } catch {
        if (!cancelled) setSyncStatus('error')
      }
    }

    void loadWorkspace()
    return () => {
      cancelled = true
    }
  }, [authStatus, storageReady, userId])

  useEffect(() => {
    if (!storageReady) return

    try {
      if (source?.kind === 'csv') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, text: source.text, fileName: source.fileName, unit }),
        )
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Keep the import usable if browser storage is unavailable or full.
    }
  }, [source, storageReady, unit])

  useEffect(() => {
    if (!storageReady) return

    try {
      localStorage.setItem(
        EVENTS_STORAGE_KEY,
        JSON.stringify({ version: 1, events: savedEvents, selectedEventId }),
      )
      localStorage.removeItem(LEGACY_EVENT_STORAGE_KEY)
    } catch {
      // Keep saved events available for the current session if storage is unavailable or full.
    }
  }, [savedEvents, selectedEventId, storageReady])

  useEffect(() => {
    const workspaceKey = CLOUD_SYNC_ENABLED ? userId : 'local'
    if (!workspaceKey || cloudReadyUserId !== workspaceKey) return

    const payload: WorkspacePayload = {
      version: 1,
      garminImport:
        source?.kind === 'csv' ? { text: source.text, fileName: source.fileName, unit } : null,
      savedEvents,
      selectedEventId,
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const response = await fetch('/api/workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Gagal menyimpan workspace.')
        if (!controller.signal.aborted) setSyncStatus('saved')
      } catch {
        if (!controller.signal.aborted) setSyncStatus('error')
      }
    }, 700)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [authStatus, cloudReadyUserId, savedEvents, selectedEventId, source, unit, userId])

  useEffect(() => {
    if (CLOUD_SYNC_ENABLED || !lanOrigin || syncStatus !== 'saved') return
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return

    const target = new URL(lanOrigin)
    target.pathname = window.location.pathname
    target.search = window.location.search
    target.hash = window.location.hash
    window.location.replace(target.toString())
  }, [lanOrigin, syncStatus])

  const saveNewEvent = () => {
    const event = { id: crypto.randomUUID(), race }
    setSavedEvents((current) => [...current, event])
    setSelectedEventId(event.id)
  }

  const updateSelectedEvent = () => {
    if (!selectedEventId) return
    setSavedEvents((current) =>
      current.map((event) => (event.id === selectedEventId ? { ...event, race } : event)),
    )
  }

  const selectEvent = (id: string) => {
    const event = savedEvents.find((savedEvent) => savedEvent.id === id)
    if (!event) return
    setRace(event.race)
    setPresetId(null)
    setSelectedEventId(event.id)
  }

  const deleteEvent = (id: string) => {
    setSavedEvents((current) => current.filter((event) => event.id !== id))
    if (selectedEventId === id) setSelectedEventId(null)
  }

  const selectedEvent = savedEvents.find((event) => event.id === selectedEventId)
  const isSelectedEventCurrent =
    selectedEvent !== undefined && JSON.stringify(selectedEvent.race) === JSON.stringify(race)

  const parsed = useMemo(() => {
    if (!source) return { activities: [] as Activity[], skipped: 0, error: null }
    if (source.kind === 'sample') return { activities: source.activities, skipped: 0, error: null }
    return parseGarminCsv(source.text, unit)
  }, [source, unit])

  const summary = useMemo(() => summarizeTraining(parsed.activities), [parsed.activities])
  const projection = useMemo(() => (summary ? projectRace(summary, race) : null), [summary, race])

  const sourceLabel = source ? (source.kind === 'csv' ? source.fileName : 'Data contoh (pelari trail)') : null

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="data-heading" className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <h2 id="data-heading" className="sr-only">
          Data latihan Garmin
        </h2>
        <GarminImport
          sourceLabel={sourceLabel}
          activityCount={parsed.activities.length}
          skipped={parsed.skipped}
          error={parsed.error}
          syncStatus={syncStatus}
          unit={unit}
          onUnitChange={setUnit}
          onFile={(text, fileName) => setSource({ kind: 'csv', text, fileName })}
          onSample={() => setSource({ kind: 'sample', activities: generateSampleActivities() })}
          onClear={() => setSource(null)}
        />
        <TrainingSummary summary={summary} />
      </section>

      <section aria-labelledby="race-heading" className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <h2 id="race-heading" className="sr-only">
          Race dan projection
        </h2>
        <RaceSetup
          race={race}
          activePresetId={presetId}
          savedEvents={savedEvents}
          selectedEventId={selectedEventId}
          isSelectedEventCurrent={isSelectedEventCurrent}
          onSaveNewEvent={saveNewEvent}
          onUpdateSelectedEvent={updateSelectedEvent}
          onSelectEvent={selectEvent}
          onDeleteEvent={deleteEvent}
          onChange={(next) => {
            setRace(next)
            setPresetId(null)
          }}
          onPreset={(id, config) => {
            setRace(config)
            setPresetId(id)
          }}
        />
        <div className="lg:sticky lg:top-6">
          <ProjectionResult projection={projection} race={race} summary={summary} />
        </div>
      </section>
    </div>
  )
}
