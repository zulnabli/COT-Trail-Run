import type { DistanceUnit } from '@/lib/garmin'
import type { RaceConfig } from '@/lib/projection'

export type SavedRaceEvent = { id: string; race: RaceConfig }

export type WorkspacePayload = {
  version: 1
  garminImport: { text: string; fileName: string; unit: DistanceUnit } | null
  savedEvents: SavedRaceEvent[]
  selectedEventId: string | null
}

export const MAX_CSV_CHARACTERS = 5_000_000

export function isRaceConfig(value: unknown): value is RaceConfig {
  if (typeof value !== 'object' || value === null) return false
  const race = value as Record<string, unknown>
  const checkpoints = race.checkpoints
  const course = race.course
  const courseProfile = typeof course === 'object' && course !== null ? (course as Record<string, unknown>) : null

  return (
    (race.type === 'marathon' || race.type === 'ultra') &&
    typeof race.name === 'string' &&
    (race.raceDate === undefined || race.raceDate === null || typeof race.raceDate === 'string') &&
    typeof race.distanceKm === 'number' &&
    Number.isFinite(race.distanceKm) &&
    typeof race.gainM === 'number' &&
    Number.isFinite(race.gainM) &&
    typeof race.cutoffSec === 'number' &&
    Number.isFinite(race.cutoffSec) &&
    ['road', 'trail-easy', 'trail-technical', 'trail-extreme'].includes(String(race.terrain)) &&
    ['cool', 'warm', 'hot-humid'].includes(String(race.weather)) &&
    typeof race.stopMinPerCp === 'number' &&
    Number.isFinite(race.stopMinPerCp) &&
    Array.isArray(checkpoints) &&
    checkpoints.every(
      (checkpoint) =>
        typeof checkpoint === 'object' &&
        checkpoint !== null &&
        typeof checkpoint.id === 'string' &&
        typeof checkpoint.name === 'string' &&
        typeof checkpoint.km === 'number' &&
        Number.isFinite(checkpoint.km) &&
        (checkpoint.cutoffSec === null ||
          (typeof checkpoint.cutoffSec === 'number' && Number.isFinite(checkpoint.cutoffSec))),
    ) &&
    (course === null ||
      (courseProfile !== null &&
        typeof courseProfile.name === 'string' &&
        typeof courseProfile.distanceKm === 'number' &&
        Number.isFinite(courseProfile.distanceKm) &&
        typeof courseProfile.gainM === 'number' &&
        Number.isFinite(courseProfile.gainM) &&
        typeof courseProfile.lossM === 'number' &&
        Number.isFinite(courseProfile.lossM) &&
        Array.isArray(courseProfile.points) &&
        courseProfile.points.length <= 501))
  )
}

export function isSavedRaceEvent(value: unknown): value is SavedRaceEvent {
  if (typeof value !== 'object' || value === null) return false
  const event = value as Record<string, unknown>
  return typeof event.id === 'string' && isRaceConfig(event.race)
}

export function isWorkspacePayload(value: unknown): value is WorkspacePayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  if (
    payload.version !== 1 ||
    !Array.isArray(payload.savedEvents) ||
    !payload.savedEvents.every(isSavedRaceEvent) ||
    !(payload.selectedEventId === null || typeof payload.selectedEventId === 'string')
  ) {
    return false
  }

  const garminImport = payload.garminImport
  if (garminImport === null) return true
  if (typeof garminImport !== 'object') return false

  const imported = garminImport as Record<string, unknown>
  return (
    typeof imported.text === 'string' &&
    imported.text.length <= MAX_CSV_CHARACTERS &&
    typeof imported.fileName === 'string' &&
    (imported.unit === 'km' || imported.unit === 'mi')
  )
}