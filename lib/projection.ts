import { effortKm, type Activity } from './garmin'
import { gainAtKm, type CourseProfile } from './gpx'

export type RaceType = 'marathon' | 'ultra'
export type Terrain = 'road' | 'trail-easy' | 'trail-technical' | 'trail-extreme'
export type Weather = 'cool' | 'warm' | 'hot-humid'

export type Checkpoint = {
  id: string
  name: string
  km: number
  cutoffSec: number | null
}

export type RaceConfig = {
  type: RaceType
  name: string
  raceDate?: string | null
  distanceKm: number
  gainM: number
  cutoffSec: number
  terrain: Terrain
  weather: Weather
  stopMinPerCp: number
  checkpoints: Checkpoint[]
  course: CourseProfile | null
}

export const TERRAIN_OPTIONS: { value: Terrain; label: string; factor: number }[] = [
  { value: 'road', label: 'Jalan raya', factor: 1 },
  { value: 'trail-easy', label: 'Trail mudah', factor: 1.06 },
  { value: 'trail-technical', label: 'Trail teknikal', factor: 1.15 },
  { value: 'trail-extreme', label: 'Sangat teknikal', factor: 1.3 },
]

export const WEATHER_OPTIONS: { value: Weather; label: string; factor: number }[] = [
  { value: 'cool', label: 'Sejuk / nyaman', factor: 1 },
  { value: 'warm', label: 'Panas', factor: 1.03 },
  { value: 'hot-humid', label: 'Panas & lembap', factor: 1.07 },
]

const MARATHON_KM = 42.195
const RIEGEL_K = 1.06
const ULTRA_K = 1.15
const WEEKS_WINDOW = 16

export type WeeklyVolume = { label: string; start: Date; km: number; ascent: number }

export type BasisRun = { activity: Activity; predictedSec: number }

export type TrainingSummary = {
  windowEnd: Date
  activityCount: number
  weeklyKmAvg: number
  weeklyAscentAvg: number
  longestEffortKm: number
  longestActivity: Activity | null
  marathonEquivalentSec: number | null
  basisRuns: BasisRun[]
  weekly: WeeklyVolume[]
  confidence: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const DAY_MS = 86_400_000

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function calendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

function buildTrainingCalendar(
  summary: TrainingSummary,
  race: RaceConfig,
  weeklyKmRequired: number,
  longEffortRequired: number,
  weeklyAscentRequiredM: number | null,
): TrainingCalendar {
  const lastTrainingDate = new Date(
    summary.windowEnd.getFullYear(),
    summary.windowEnd.getMonth(),
    summary.windowEnd.getDate(),
  )
  const raceDate = race.raceDate ? parseDateOnly(race.raceDate) : null
  const empty = (status: TrainingCalendar['status']): TrainingCalendar => ({
    status,
    lastTrainingDate,
    raceDate,
    weeks: [],
  })
  if (!race.raceDate) return empty('missing-date')
  if (!raceDate) return empty('invalid-date')

  const startDate = new Date(lastTrainingDate)
  startDate.setDate(startDate.getDate() + 1)
  const daysUntilRace = calendarDayNumber(raceDate) - calendarDayNumber(startDate)
  if (daysUntilRace < 0) return empty('race-before-training')
  if (daysUntilRace > 364) return empty('too-far')

  const totalDays = daysUntilRace + 1
  const totalWeeks = Math.ceil(totalDays / 7)
  const weeks: TrainingCalendarWeek[] = []
  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const firstOffset = weekIndex * 7
    const daysThisWeek = Math.min(7, totalDays - firstOffset)
    const daysLeftAtWeekEnd = daysUntilRace - firstOffset - daysThisWeek + 1
    const raceWeek = daysLeftAtWeekEnd === 0
    const taper = daysLeftAtWeekEnd <= 13
    const recovery = !taper && (weekIndex + 1) % 4 === 0
    const phase = raceWeek ? 'Minggu race' : taper ? 'Taper' : recovery ? 'Pemulihan' : 'Bina'
    const progression = Math.min(1.1 ** (weekIndex + 1), weeklyKmRequired / Math.max(summary.weeklyKmAvg, 1))
    const longProgression = Math.min(
      1.1 ** (weekIndex + 1),
      longEffortRequired / Math.max(summary.longestEffortKm, 1),
    )
    const weeklyKmTarget =
      Math.min(weeklyKmRequired, summary.weeklyKmAvg * progression) *
      (taper ? (daysLeftAtWeekEnd <= 6 ? 0.5 : 0.7) : recovery ? 0.75 : 1) *
      (daysThisWeek / 7)
    const longEffortTargetKm =
      Math.min(longEffortRequired, summary.longestEffortKm * longProgression) *
      (taper ? (daysLeftAtWeekEnd <= 6 ? 0.4 : 0.65) : recovery ? 0.75 : 1)
    let ascentBaselineM = summary.weeklyAscentAvg
    if (weeklyAscentRequiredM !== null && ascentBaselineM <= 0) {
      ascentBaselineM = Math.min(50, weeklyAscentRequiredM)
    }
    const ascentProgression =
      weeklyAscentRequiredM === null
        ? 0
        : Math.min(1.1 ** (weekIndex + 1), weeklyAscentRequiredM / Math.max(ascentBaselineM, 1))
    const weeklyAscentTargetM =
      weeklyAscentRequiredM === null
        ? null
        : Math.min(weeklyAscentRequiredM, ascentBaselineM * ascentProgression) *
          (taper ? (daysLeftAtWeekEnd <= 6 ? 0.5 : 0.7) : recovery ? 0.75 : 1) *
          (daysThisWeek / 7)
    const days: Omit<TrainingCalendarDay, 'distanceKm' | 'ascentTargetM'>[] = []

    for (let dayIndex = 0; dayIndex < daysThisWeek; dayIndex++) {
      const offset = firstOffset + dayIndex
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + offset)
      const daysToRace = daysUntilRace - offset
      if (daysToRace === 0) {
        days.push({ date, title: 'Hari race', detail: 'Mula terkawal, ikut pelan checkpoint dan gunakan pemakanan yang telah diuji.' })
      } else if (daysToRace <= 6) {
        const session = daysToRace >= 5
          ? { title: 'Easy ringan', detail: 'Larian easy 20–40 minit; tiada latihan kekuatan berat.' }
          : daysToRace >= 3
            ? { title: 'Rehat / shakeout', detail: 'Rehat atau jog 15–25 minit jika badan terasa segar.' }
            : { title: 'Rehat', detail: 'Rehat, sediakan gear dan perjalanan; elakkan sesi berat.' }
        days.push({ date, ...session })
      } else {
        const weekday = date.getDay()
        let session = { title: 'Rehat', detail: 'Rehat penuh atau mobiliti ringan.' }
        if (weekday === 2) session = { title: 'Easy + kekuatan A', detail: 'Larian easy; squat, step-up, calf raise dan plank, 2–3 set.' }
        if (weekday === 3 || weekday === 0) session = { title: 'Easy / pemulihan', detail: 'Larian santai atau jog/hike sangat easy.' }
        if (weekday === 4) session = {
          title: recovery || taper ? 'Easy' : 'Kualiti',
          detail: recovery || taper
            ? 'Kurangkan intensiti; buat larian easy.'
            : race.terrain === 'road' ? 'Tempo terkawal; tamatkan dengan baki tenaga.' : 'Ulangan bukit atau power-hiking di cerun.',
        }
        if (weekday === 5) session = {
          title: taper ? 'Mobiliti ringan' : 'Kekuatan B',
          detail: taper
            ? 'Taper: elakkan beban berat, buat mobiliti sahaja.'
            : 'Split squat, glute bridge, reverse lunge dan side plank, 2–3 set.',
        }
        if (weekday === 6) session = {
          title: recovery ? 'Larian panjang ringan' : 'Larian panjang',
          detail: `Sasaran sehingga ${Math.round(longEffortTargetKm * 10) / 10} km-effort; latih pemakanan dan minuman.`,
        }
        if (taper && weekday === 2) session = { title: 'Easy + mobiliti', detail: 'Larian easy pendek; tiada latihan kekuatan berat.' }
        days.push({ date, ...session })
      }
    }

    const distanceWeight = (title: string) => {
      if (title.includes('Larian panjang')) return 0.4
      if (title === 'Kualiti') return 0.2
      if (title.includes('Easy')) return 0.15
      if (title.includes('Pemulihan') || title.includes('shakeout')) return 0.1
      return 0
    }
    const runDays = days.filter((day) => distanceWeight(day.title) > 0)
    const longRunDay = runDays.find((day) => day.title.includes('Larian panjang'))
    const longAscentShare = 0.55
    const longRunKm = longRunDay
      ? runDays.length === 1
        ? weeklyKmTarget
        : Math.min(
            weeklyKmTarget * 0.45,
            Math.max(0, longEffortTargetKm - ((weeklyAscentTargetM ?? 0) * longAscentShare) / 100),
          )
      : 0
    const remainingKm = Math.max(0, weeklyKmTarget - longRunKm)
    const otherRunDays = runDays.filter((day) => day !== longRunDay)
    const otherDistanceWeight = otherRunDays.reduce((sum, day) => sum + distanceWeight(day.title), 0)
    const otherAscentWeight = otherRunDays.reduce(
      (sum, day) => sum + (day.title === 'Kualiti' ? 0.25 : 0.15),
      0,
    )
    const plannedDays: TrainingCalendarDay[] = days.map((day) => {
      if (day.title === 'Hari race') {
        return { ...day, distanceKm: race.distanceKm, ascentTargetM: Math.max(0, race.gainM) }
      }

      const weight = distanceWeight(day.title)
      const distanceKm =
        weight === 0
          ? null
          : day === longRunDay
            ? longRunKm
            : otherDistanceWeight > 0
              ? (remainingKm * weight) / otherDistanceWeight
              : null
      const ascentWeight = day === longRunDay ? longAscentShare : day.title === 'Kualiti' ? 0.25 : weight > 0 ? 0.15 : 0
      const ascentTargetM =
        weeklyAscentTargetM === null || ascentWeight === 0
          ? null
          : day === longRunDay
            ? weeklyAscentTargetM * ascentWeight
            : otherAscentWeight > 0
              ? (weeklyAscentTargetM * (1 - longAscentShare) * ascentWeight) / otherAscentWeight
              : weeklyAscentTargetM * ascentWeight

      return {
        ...day,
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        ascentTargetM: ascentTargetM === null ? null : Math.round(ascentTargetM),
      }
    })

    weeks.push({
      number: weekIndex + 1,
      phase,
      weeklyKmTarget: Math.round(weeklyKmTarget * 10) / 10,
      weeklyAscentTargetM: weeklyAscentTargetM === null ? null : Math.round(weeklyAscentTargetM),
      longRunKm: Math.round(longRunKm * 10) / 10,
      longEffortTargetKm,
      days: plannedDays,
    })
  }

  return { status: 'ready', lastTrainingDate, raceDate, weeks }
}

export function summarizeTraining(activities: Activity[]): TrainingSummary | null {
  if (activities.length === 0) return null
  const windowEnd = new Date(Math.max(...activities.map((a) => a.date.getTime())))
  const endDay = new Date(windowEnd)
  endDay.setHours(23, 59, 59, 999)
  const windowStartMs = endDay.getTime() - WEEKS_WINDOW * 7 * DAY_MS

  const inWindow = activities.filter((a) => a.date.getTime() > windowStartMs)

  const weekly: WeeklyVolume[] = Array.from({ length: WEEKS_WINDOW }, (_, i) => {
    const start = new Date(windowStartMs + i * 7 * DAY_MS)
    return {
      label: start.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }),
      start,
      km: 0,
      ascent: 0,
    }
  })
  for (const a of inWindow) {
    const idx = Math.min(WEEKS_WINDOW - 1, Math.floor((a.date.getTime() - windowStartMs) / (7 * DAY_MS)))
    weekly[idx].km += a.distanceKm
    weekly[idx].ascent += a.ascentM
  }
  for (const w of weekly) {
    w.km = Math.round(w.km * 10) / 10
    w.ascent = Math.round(w.ascent)
  }

  const last8 = weekly.slice(-8)
  const weeklyKmAvg = last8.reduce((sum, w) => sum + w.km, 0) / last8.length
  const weeklyAscentAvg = last8.reduce((sum, w) => sum + w.ascent, 0) / last8.length

  const last12Ms = endDay.getTime() - 12 * 7 * DAY_MS
  let longestActivity: Activity | null = null
  for (const a of inWindow) {
    if (a.date.getTime() <= last12Ms) continue
    if (!longestActivity || effortKm(a) > effortKm(longestActivity)) longestActivity = a
  }

  const candidates: BasisRun[] = inWindow
    .filter((a) => a.category !== 'hike' && a.distanceKm >= 5)
    .filter((a) => {
      const pacePerEffortKm = a.durationSec / effortKm(a)
      return pacePerEffortKm >= 150 && pacePerEffortKm <= 900
    })
    .map((a) => ({
      activity: a,
      predictedSec: a.durationSec * (MARATHON_KM / effortKm(a)) ** RIEGEL_K,
    }))
    .sort((a, b) => a.predictedSec - b.predictedSec)

  const basisRuns = candidates.slice(0, 3)
  const marathonEquivalentSec =
    basisRuns.length > 0 ? basisRuns.reduce((sum, b) => sum + b.predictedSec, 0) / basisRuns.length : null

  const hasLongEffort = candidates.some((c) => effortKm(c.activity) >= 21)
  const confidence = clamp(0.3 + 0.1 * Math.min(candidates.length, 5) + (hasLongEffort ? 0.2 : 0), 0, 1)

  return {
    windowEnd,
    activityCount: inWindow.length,
    weeklyKmAvg,
    weeklyAscentAvg,
    longestEffortKm: longestActivity ? effortKm(longestActivity) : 0,
    longestActivity,
    marathonEquivalentSec,
    basisRuns,
    weekly,
    confidence,
  }
}

export type Verdict = 'likely' | 'borderline' | 'unlikely'

export type ReadinessItem = {
  key: 'volume' | 'long' | 'vert'
  label: string
  actual: number
  required: number
  unit: string
  score: number
}

export type CheckpointProjection = {
  id: string
  name: string
  km: number
  segmentKm: number
  segmentSec: number
  arrivalSec: number
  cutoffSec: number | null
  marginSec: number | null
  probability: number | null
  isFinish: boolean
}

export type TrainingPlanSession = { day: string; title: string; detail: string }

export type TrainingCalendarDay = {
  date: Date
  title: string
  detail: string
  distanceKm: number | null
  ascentTargetM: number | null
}

export type TrainingCalendarWeek = {
  number: number
  phase: string
  weeklyKmTarget: number
  weeklyAscentTargetM: number | null
  longRunKm: number
  longEffortTargetKm: number
  days: TrainingCalendarDay[]
}

export type TrainingCalendar = {
  status: 'ready' | 'missing-date' | 'invalid-date' | 'race-before-training' | 'too-far'
  lastTrainingDate: Date
  raceDate: Date | null
  weeks: TrainingCalendarWeek[]
}

export type TrainingPlan = {
  weeklyKmTarget: number
  longEffortTargetKm: number
  sessions: TrainingPlanSession[]
  strengthSessions: string[]
  raceStrategy: string[]
  calendar: TrainingCalendar
}

export type Projection = {
  raceEffortKm: number
  isUltra: boolean
  predictedSec: number
  movingSec: number
  rangeLowSec: number
  rangeHighSec: number
  avgPaceSec: number
  probability: number
  verdict: Verdict
  readiness: number
  readinessItems: ReadinessItem[]
  factors: { label: string; multiplier: number }[]
  checkpoints: CheckpointProjection[]
  requiredMarathonSec: number | null
  currentMarathonSec: number
  recommendations: string[]
  trainingPlan: TrainingPlan
}

function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

export function projectRace(summary: TrainingSummary, race: RaceConfig): Projection | null {
  const T42 = summary.marathonEquivalentSec
  if (!T42 || !(race.distanceKm > 0)) return null

  const gainM = Math.max(0, race.gainM || 0)
  const raceEffortKm = race.distanceKm + gainM / 100
  const isUltra = race.type === 'ultra' || raceEffortKm > 45
  const k = raceEffortKm <= MARATHON_KM ? RIEGEL_K : ULTRA_K
  const baseSec = T42 * (raceEffortKm / MARATHON_KM) ** k

  const reqWeekly = isUltra ? Math.min(45 + (raceEffortKm - MARATHON_KM) * 0.3, 100) : 45
  const reqLong = isUltra ? Math.min(raceEffortKm * 0.45, 55) : 28
  const needsVert = gainM >= 500
  const reqVert = needsVert ? Math.min(gainM * 0.2, 2500) : 0

  const readinessItems: ReadinessItem[] = [
    {
      key: 'volume',
      label: 'Purata jarak mingguan',
      actual: summary.weeklyKmAvg,
      required: reqWeekly,
      unit: 'km',
      score: clamp(summary.weeklyKmAvg / reqWeekly, 0, 1.2),
    },
    {
      key: 'long',
      label: 'Larian terpanjang',
      actual: summary.longestEffortKm,
      required: reqLong,
      unit: 'km-effort',
      score: clamp(summary.longestEffortKm / reqLong, 0, 1.2),
    },
  ]
  if (needsVert) {
    readinessItems.push({
      key: 'vert',
      label: 'Purata D+ mingguan',
      actual: summary.weeklyAscentAvg,
      required: reqVert,
      unit: 'm',
      score: clamp(summary.weeklyAscentAvg / reqVert, 0, 1.2),
    })
  }

  const readiness = needsVert
    ? readinessItems[0].score * 0.4 + readinessItems[1].score * 0.4 + readinessItems[2].score * 0.2
    : readinessItems[0].score * 0.5 + readinessItems[1].score * 0.5
  const deficit = Math.max(0, 1 - Math.min(readiness, 1))
  const readinessPenalty = 1 + deficit * (isUltra ? 0.35 : 0.2)

  const terrainFactor = TERRAIN_OPTIONS.find((t) => t.value === race.terrain)?.factor ?? 1
  const weatherFactor = WEATHER_OPTIONS.find((w) => w.value === race.weather)?.factor ?? 1
  const combinedFactor = terrainFactor * weatherFactor * readinessPenalty
  const movingSec = baseSec * combinedFactor

  const validCps = race.checkpoints
    .filter((cp) => cp.km > 0 && cp.km < race.distanceKm)
    .sort((a, b) => a.km - b.km)
  const stopSec = Math.max(0, race.stopMinPerCp || 0) * 60
  const predictedSec = movingSec + validCps.length * stopSec

  const cv =
    (isUltra ? 0.07 + Math.min(raceEffortKm, 250) / 2500 : 0.05) +
    (1 - summary.confidence) * 0.04 +
    deficit * 0.08
  const finishFactor = isUltra ? 0.85 + 0.15 * Math.min(readiness, 1) : 0.95 + 0.05 * Math.min(readiness, 1)

  const probabilityAt = (cutoff: number, arrival: number) =>
    normCdf((cutoff - arrival) / Math.max(arrival * cv, 1))

  const gainUntil = (km: number) => {
    if (race.course && race.course.gainM > 0) {
      const scaledKm = (km * race.course.distanceKm) / race.distanceKm
      return (gainAtKm(race.course, scaledKm) * gainM) / race.course.gainM
    }
    return (gainM * km) / race.distanceKm
  }

  const checkpoints: CheckpointProjection[] = []
  let prevKm = 0
  let prevArrival = 0
  const allStops = [
    ...validCps.map((cp) => ({ ...cp, isFinish: false })),
    { id: 'finish', name: 'Garisan Penamat', km: race.distanceKm, cutoffSec: race.cutoffSec, isFinish: true },
  ]
  allStops.forEach((cp, i) => {
    const effAtCp = cp.km + gainUntil(cp.km) / 100
    const arrivalSec = movingSec * (effAtCp / raceEffortKm) ** k + i * stopSec
    const cutoff = cp.cutoffSec && cp.cutoffSec > 0 ? cp.cutoffSec : null
    checkpoints.push({
      id: cp.id,
      name: cp.name || `CP${i + 1}`,
      km: cp.km,
      segmentKm: cp.km - prevKm,
      segmentSec: arrivalSec - prevArrival,
      arrivalSec,
      cutoffSec: cutoff,
      marginSec: cutoff ? cutoff - arrivalSec : null,
      probability: cutoff ? probabilityAt(cutoff, arrivalSec) : null,
      isFinish: cp.isFinish,
    })
    prevKm = cp.km
    prevArrival = arrivalSec + (cp.isFinish ? 0 : stopSec)
  })

  const cutoffProbs = checkpoints.map((c) => c.probability).filter((p): p is number => p != null)
  const probability = cutoffProbs.length > 0 ? Math.min(...cutoffProbs) * finishFactor : finishFactor

  const verdict: Verdict = probability >= 0.75 ? 'likely' : probability >= 0.45 ? 'borderline' : 'unlikely'

  const requiredMarathonSec =
    race.cutoffSec > 0
      ? (race.cutoffSec * 0.9 - validCps.length * stopSec) /
        (combinedFactor * (raceEffortKm / MARATHON_KM) ** k)
      : null

  const recommendations: string[] = []
  const [vol, long, vert] = readinessItems
  if (vol.score < 0.85) {
    recommendations.push(
      `Naikkan purata jarak mingguan dari ${Math.round(vol.actual)} km ke sekitar ${Math.round(vol.required)} km secara beransur (maksimum +10% seminggu).`,
    )
  }
  if (long.score < 0.85) {
    recommendations.push(
      `Larian terpanjang anda ${Math.round(long.actual)} km-effort. Sasarkan sekurang-kurangnya ${Math.round(long.required)} km-effort — boleh guna back-to-back long run hujung minggu.`,
    )
  }
  if (vert && vert.score < 0.85) {
    recommendations.push(
      `Tambah latihan bukit & tangga: sasaran ~${Math.round(vert.required)} m D+ seminggu (sekarang ${Math.round(vert.actual)} m).`,
    )
  }
  const lateCp = checkpoints.find((c) => c.marginSec != null && c.marginSec < 0)
  if (lateCp) {
    recommendations.push(
      `Anda dijangka lewat di ${lateCp.name} (km ${Math.round(lateCp.km)}). Fokus pada kelajuan power-hiking dan kurangkan masa berhenti di CP.`,
    )
  }
  if (race.weather === 'hot-humid') {
    recommendations.push('Latih adaptasi cuaca panas & lembap, serta rancang strategi hidrasi dan elektrolit.')
  }
  if (summary.confidence < 0.6) {
    recommendations.push(
      'Data larian laju/terkini terhad — ramalan kurang tepat. Muat naik lebih banyak aktiviti (termasuk tempo atau race).',
    )
  }
  if (recommendations.length === 0 || (verdict === 'likely' && recommendations.length <= 1)) {
    recommendations.push('Anda berada di landasan yang baik. Kekalkan konsistensi dan rancang taper 2–3 minggu sebelum race.')
  }

  const gradualTarget = (actual: number, required: number) => Math.max(actual, Math.min(required, actual * 1.1))
  const weeklyKmTarget = gradualTarget(vol.actual, vol.required)
  const longEffortTargetKm = gradualTarget(long.actual, long.required)
  const qualitySession = race.terrain === 'road'
    ? 'Tempo terkawal; jika letih, tukar kepada larian easy.'
    : 'Ulangan bukit atau power-hiking di cerun; jika letih, tukar kepada larian easy.'
  const trainingPlan: TrainingPlan = {
    weeklyKmTarget,
    longEffortTargetKm,
    sessions: [
      { day: 'Isnin', title: 'Rehat', detail: 'Rehat penuh atau mobiliti ringan.' },
      { day: 'Selasa', title: 'Easy + kekuatan A', detail: 'Larian easy, kemudian sesi kekuatan A.' },
      { day: 'Rabu', title: 'Easy', detail: 'Larian santai pada effort yang boleh berbual.' },
      { day: 'Khamis', title: 'Kualiti', detail: qualitySession },
      { day: 'Jumaat', title: 'Kekuatan B', detail: 'Sesi kekuatan B; elakkan beban berat jika badan belum pulih.' },
      {
        day: 'Sabtu',
        title: 'Larian panjang',
        detail: `Sasarkan sekitar ${Math.round(longEffortTargetKm * 10) / 10} km-effort dan latih pemakanan/minuman race.`,
      },
      {
        day: 'Ahad',
        title: 'Pulih',
        detail: isUltra
          ? 'Rehat atau jog/hike sangat easy; back-to-back hanya jika sudah biasa.'
          : 'Rehat atau jog pendek yang sangat easy.',
      },
    ],
    strengthSessions: [
      'Dua sesi seminggu, jarakkan sekurang-kurangnya 48 jam; mula dengan 2 set, kemudian 3 set apabila teknik stabil.',
      'Sesi A: squat, hip hinge, step-up, calf raise dan plank, 8–12 ulangan setiap set.',
      'Sesi B: split squat, glute bridge/hinge, reverse lunge, calf raise sebelah kaki dan side plank, 8–12 ulangan.',
      'Mulakan dengan berat badan atau beban ringan, tinggalkan 2–3 ulangan sebelum gagal, dan tambah beban beransur.',
    ],
    raceStrategy: [
      'Mulakan pada effort terkawal; jangan cuba “bank” masa dengan berlari terlalu laju pada awal race.',
      race.terrain === 'road'
        ? 'Kekalkan pace sekata dan elakkan lonjakan pace yang tidak dapat dikekalkan.'
        : 'Power-hike cerun curam dan berlatih dengan gear yang akan digunakan semasa race.',
      'Gunakan masa unjuran checkpoint sebagai panduan dan sasarkan buffer sebelum COT; masukkan masa berhenti yang realistik.',
      race.weather === 'hot-humid'
        ? 'Uji strategi air, elektrolit dan pemakanan dalam latihan; jangan cuba produk baharu pada hari race.'
        : 'Uji strategi pemakanan dan minuman dalam larian panjang sebelum hari race.',
    ],
    calendar: buildTrainingCalendar(summary, race, vol.required, long.required, vert?.required ?? null),
  }

  return {
    raceEffortKm,
    isUltra,
    predictedSec,
    movingSec,
    rangeLowSec: predictedSec * (1 - cv),
    rangeHighSec: predictedSec * (1 + cv),
    avgPaceSec: predictedSec / race.distanceKm,
    probability,
    verdict,
    readiness,
    readinessItems,
    factors: [
      { label: 'Terrain', multiplier: terrainFactor },
      { label: 'Cuaca', multiplier: weatherFactor },
      { label: 'Kesediaan latihan', multiplier: readinessPenalty },
    ],
    checkpoints,
    requiredMarathonSec,
    currentMarathonSec: T42,
    recommendations,
    trainingPlan,
  }
}
