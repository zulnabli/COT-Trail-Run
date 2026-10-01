export function formatClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '--:--'
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function formatHM(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '--'
  const negative = sec < 0
  const totalMin = Math.round(Math.abs(sec) / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const body = h > 0 ? `${h}j ${String(m).padStart(2, '0')}m` : `${m}m`
  return negative ? `-${body}` : body
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '--'
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export function parseHM(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,3})(?::(\d{1,2}))?$/)
  if (!match) return null
  const h = Number(match[1])
  const m = match[2] ? Number(match[2]) : 0
  if (m >= 60) return null
  return h * 3600 + m * 60
}

export function toHMInput(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return ''
  const totalMin = Math.round(sec / 60)
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString('ms-MY', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })
}
