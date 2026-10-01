export type ActivityCategory = 'run' | 'trail' | 'hike'
export type DistanceUnit = 'km' | 'mi'

export type Activity = {
  date: Date
  type: string
  title: string
  category: ActivityCategory
  distanceKm: number
  durationSec: number
  ascentM: number
  avgHr: number | null
}

export type ParseResult = {
  activities: Activity[]
  skipped: number
  error: string | null
}

const COLUMN_ALIASES = {
  type: ['activity type', 'jenis aktiviti', 'type'],
  date: ['date', 'tarikh', 'start time'],
  title: ['title', 'tajuk', 'name'],
  distance: ['distance', 'jarak'],
  time: ['time', 'elapsed time', 'moving time', 'masa', 'duration'],
  ascent: ['total ascent', 'elev gain', 'elevation gain', 'jumlah pendakian'],
  hr: ['avg hr', 'average heart rate', 'purata kadar jantung'],
} as const

export function effortKm(activity: Pick<Activity, 'distanceKm' | 'ascentM'>): number {
  return activity.distanceKm + activity.ascentM / 100
}

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return Number.NaN
  const value = raw.trim()
  if (!value || value === '--') return Number.NaN
  if (/^-?\d+,\d{1,2}$/.test(value)) return Number.parseFloat(value.replace(',', '.'))
  return Number.parseFloat(value.replace(/,/g, ''))
}

function parseDuration(raw: string | undefined): number {
  if (!raw) return Number.NaN
  const value = raw.trim()
  if (!value || value === '--') return Number.NaN
  const parts = value.split(':').map((p) => Number.parseFloat(p.replace(',', '.')))
  if (parts.some((p) => Number.isNaN(p))) return Number.NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  const value = raw.trim()
  const iso = new Date(value.replace(' ', 'T'))
  if (!Number.isNaN(iso.getTime())) return iso
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function categorize(type: string, title: string): ActivityCategory | null {
  const t = type.toLowerCase()
  const combined = `${t} ${title.toLowerCase()}`
  if (/trail|ultra|denai/.test(t)) return 'trail'
  if (/run|lari|jog|treadmill/.test(t)) return 'run'
  if (/hik|mendaki|mountaineer|walk|berjalan/.test(t)) return 'hike'
  if (/trail|ultra/.test(combined)) return 'trail'
  if (/run|lari/.test(combined)) return 'run'
  return null
}

export function parseGarminCsv(text: string, unit: DistanceUnit): ParseResult {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { activities: [], skipped: 0, error: 'Fail CSV kosong atau tidak sah.' }
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const indexOf = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias)
      if (idx !== -1) return idx
    }
    return -1
  }

  const col = {
    type: indexOf(COLUMN_ALIASES.type),
    date: indexOf(COLUMN_ALIASES.date),
    title: indexOf(COLUMN_ALIASES.title),
    distance: indexOf(COLUMN_ALIASES.distance),
    time: indexOf(COLUMN_ALIASES.time),
    ascent: indexOf(COLUMN_ALIASES.ascent),
    hr: indexOf(COLUMN_ALIASES.hr),
  }

  if (col.date === -1 || col.distance === -1 || col.time === -1) {
    return {
      activities: [],
      skipped: 0,
      error:
        'Lajur "Date", "Distance" atau "Time" tidak dijumpai. Pastikan anda eksport CSV dari halaman Activities di Garmin Connect.',
    }
  }

  const distanceFactor = unit === 'mi' ? 1.609344 : 1
  const ascentFactor = unit === 'mi' ? 0.3048 : 1
  const activities: Activity[] = []
  let skipped = 0

  for (const row of rows.slice(1)) {
    const type = col.type !== -1 ? (row[col.type] ?? '') : 'Running'
    const title = col.title !== -1 ? (row[col.title] ?? '') : ''
    const category = categorize(type, title)
    const date = parseDate(row[col.date])
    const distance = parseNumber(row[col.distance]) * distanceFactor
    const duration = parseDuration(row[col.time])
    const ascentRaw = col.ascent !== -1 ? parseNumber(row[col.ascent]) : 0
    const hrRaw = col.hr !== -1 ? parseNumber(row[col.hr]) : Number.NaN

    if (!category || !date || !(distance > 0) || !(duration > 0)) {
      skipped++
      continue
    }

    activities.push({
      date,
      type: type || 'Running',
      title,
      category,
      distanceKm: distance,
      durationSec: duration,
      ascentM: Number.isFinite(ascentRaw) ? ascentRaw * ascentFactor : 0,
      avgHr: Number.isFinite(hrRaw) ? hrRaw : null,
    })
  }

  activities.sort((a, b) => a.date.getTime() - b.date.getTime())

  if (activities.length === 0) {
    return {
      activities,
      skipped,
      error: 'Tiada aktiviti larian, trail atau hiking dijumpai dalam fail ini.',
    }
  }

  return { activities, skipped, error: null }
}

export function generateSampleActivities(): Activity[] {
  let seed = 20260930
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const jitter = (base: number, spread: number) => base + (rand() - 0.5) * 2 * spread

  const end = new Date()
  end.setHours(7, 0, 0, 0)
  const activities: Activity[] = []

  const add = (
    weekStart: Date,
    dayOffset: number,
    category: ActivityCategory,
    type: string,
    title: string,
    km: number,
    paceSec: number,
    ascent: number,
    hr: number,
  ) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + dayOffset)
    activities.push({
      date,
      type,
      title,
      category,
      distanceKm: Math.round(km * 100) / 100,
      durationSec: Math.round(km * paceSec),
      ascentM: Math.round(ascent),
      avgHr: Math.round(hr),
    })
  }

  for (let w = 15; w >= 0; w--) {
    const weekStart = new Date(end)
    weekStart.setDate(end.getDate() - (w * 7 + 6))
    const progress = (15 - w) / 15
    const recoveryWeek = w % 4 === 3
    const load = recoveryWeek ? 0.7 : 1

    add(weekStart, 1, 'run', 'Running', 'Easy Run', jitter(9, 1) * load, jitter(370, 10), jitter(60, 20), jitter(142, 4))
    if (w % 2 === 0) {
      add(weekStart, 2, 'run', 'Running', 'Tempo Run', jitter(10, 0.5), jitter(305 - progress * 8, 4), jitter(40, 15), jitter(162, 3))
    } else {
      add(weekStart, 2, 'run', 'Track Running', 'Intervals', jitter(8, 0.5), jitter(320, 6), 5, jitter(158, 3))
    }
    add(weekStart, 4, 'run', 'Running', 'Easy Run', jitter(8, 1) * load, jitter(375, 10), jitter(50, 20), jitter(140, 4))

    const longKm = Math.min(16 + (15 - w) * 1.1, 32) * load
    add(weekStart, 5, 'trail', 'Trail Running', 'Long Trail Run', jitter(longKm, 1), jitter(510, 20), longKm * jitter(48, 8), jitter(148, 4))

    if (w === 5) {
      add(weekStart, 6, 'run', 'Running', 'Half Marathon Race', 21.1, 6450 / 21.1, 90, 171)
    } else if (w % 3 === 0) {
      add(weekStart, 6, 'hike', 'Hiking', 'Bukit Hike', jitter(9, 1.5), jitter(840, 60), jitter(650, 120), jitter(118, 6))
    } else {
      add(weekStart, 6, 'run', 'Running', 'Recovery Run', jitter(6, 1) * load, jitter(395, 10), jitter(30, 10), jitter(135, 4))
    }
  }

  return activities.sort((a, b) => a.date.getTime() - b.date.getTime())
}
