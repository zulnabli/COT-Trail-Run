export type CoursePoint = { km: number; ele: number; gain: number }

export type CourseProfile = {
  name: string
  distanceKm: number
  gainM: number
  lossM: number
  points: CoursePoint[]
}

const EARTH_RADIUS_KM = 6371
const ELEVATION_THRESHOLD_M = 4
const MAX_CHART_POINTS = 500

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

export function parseGpx(text: string, fallbackName: string): CourseProfile {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Fail GPX tidak sah.')
  }

  let nodes = Array.from(doc.getElementsByTagName('trkpt'))
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagName('rtept'))
  if (nodes.length < 2) throw new Error('Tiada titik laluan (trkpt) dalam fail GPX.')

  const name = doc.getElementsByTagName('name')[0]?.textContent?.trim() || fallbackName

  const full: CoursePoint[] = []
  let distance = 0
  let gain = 0
  let loss = 0
  let prevLat = Number.NaN
  let prevLon = Number.NaN
  let refEle = Number.NaN

  for (const node of nodes) {
    const lat = Number.parseFloat(node.getAttribute('lat') ?? '')
    const lon = Number.parseFloat(node.getAttribute('lon') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleText = node.getElementsByTagName('ele')[0]?.textContent
    const ele = eleText ? Number.parseFloat(eleText) : 0

    if (Number.isFinite(prevLat)) distance += haversineKm(prevLat, prevLon, lat, lon)
    if (Number.isNaN(refEle)) {
      refEle = ele
    } else {
      const diff = ele - refEle
      if (diff >= ELEVATION_THRESHOLD_M) {
        gain += diff
        refEle = ele
      } else if (diff <= -ELEVATION_THRESHOLD_M) {
        loss += -diff
        refEle = ele
      }
    }

    full.push({ km: distance, ele, gain })
    prevLat = lat
    prevLon = lon
  }

  const step = Math.max(1, Math.ceil(full.length / MAX_CHART_POINTS))
  const points = full.filter((_, i) => i % step === 0)
  if (points[points.length - 1] !== full[full.length - 1]) points.push(full[full.length - 1])

  return {
    name,
    distanceKm: Math.round(distance * 100) / 100,
    gainM: Math.round(gain),
    lossM: Math.round(loss),
    points: points.map((p) => ({
      km: Math.round(p.km * 100) / 100,
      ele: Math.round(p.ele),
      gain: Math.round(p.gain),
    })),
  }
}

export function gainAtKm(course: CourseProfile, km: number): number {
  const { points } = course
  if (km <= 0) return 0
  if (km >= points[points.length - 1].km) return points[points.length - 1].gain
  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].km <= km) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi]
  const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km)
  return a.gain + (b.gain - a.gain) * t
}
