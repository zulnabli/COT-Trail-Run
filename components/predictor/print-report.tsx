'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatClock, formatHM, formatNumber, formatPace, formatShortDate } from '@/lib/format'
import { TERRAIN_OPTIONS, WEATHER_OPTIONS, type Projection, type RaceConfig, type TrainingSummary } from '@/lib/projection'

const VERDICT_LABELS = {
  likely: 'Berpotensi lepas COT',
  borderline: 'Di sempadan COT',
  unlikely: 'Berisiko tidak lepas COT',
} as const

function getElevationPaths(points: { km: number; ele: number }[]) {
  const validPoints = points.filter((point) => Number.isFinite(point.km) && Number.isFinite(point.ele))
  const minKm = validPoints[0]?.km ?? 0
  const maxKm = validPoints[validPoints.length - 1]?.km ?? minKm + 1
  const elevations = validPoints.map((point) => point.ele)
  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)
  const elevationRange = Math.max(1, maxElevation - minElevation)
  const coordinates = validPoints.map((point) => {
    const x = 48 + ((point.km - minKm) / Math.max(1, maxKm - minKm)) * 660
    const y = 68 - ((point.ele - minElevation) / elevationRange) * 52
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = `M ${coordinates.join(' L ')}`
  const area = `${line} L 708,72 L 48,72 Z`
  return { line, area, minKm, maxKm, midKm: (minKm + maxKm) / 2, minElevation, maxElevation }
}

export function PrintReport({
  projection,
  race,
  summary,
}: {
  projection: Projection
  race: RaceConfig
  summary: TrainingSummary
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  useEffect(() => setPortalRoot(document.body), [])
  if (!portalRoot) return null

  const finish = projection.checkpoints[projection.checkpoints.length - 1]
  const terrain = TERRAIN_OPTIONS.find((option) => option.value === race.terrain)?.label ?? race.terrain
  const weather = WEATHER_OPTIONS.find((option) => option.value === race.weather)?.label ?? race.weather
  const calendar = projection.trainingPlan.calendar
  const calendarStatusMessage = {
    ready: '',
    'missing-date': 'Tarikh race belum ditetapkan, jadi kalendar bertarikh belum dijana.',
    'invalid-date': 'Tarikh race tidak sah. Semak semula butiran event.',
    'race-before-training': 'Tarikh race lebih awal daripada aktiviti latihan terakhir.',
    'too-far': 'Kalendar belum dijana kerana race melebihi had perancangan 52 minggu.',
  }[calendar.status]
  const nextWeek = calendar.status === 'ready' ? calendar.weeks[0] : null
  const finishCheckpoint = projection.checkpoints[projection.checkpoints.length - 1]
  const intermediateCheckpoints = projection.checkpoints.filter((checkpoint) => !checkpoint.isFinish)
  const checkpointsWithCutoff = intermediateCheckpoints.filter((checkpoint) => checkpoint.probability !== null)
  const visibleCheckpoints = checkpointsWithCutoff.length > 0
    ? [
        ...checkpointsWithCutoff
          .sort((a, b) => (a.probability ?? 1) - (b.probability ?? 1))
          .slice(0, 4),
        finishCheckpoint,
      ].sort((a, b) => a.km - b.km)
    : [...intermediateCheckpoints.slice(0, 4), finishCheckpoint].sort((a, b) => a.km - b.km)
  const omittedCheckpointCount = projection.checkpoints.length - visibleCheckpoints.length
  const elevationPaths = race.course ? getElevationPaths(race.course.points) : null
  const weeksPerColumn = Math.ceil(calendar.weeks.length / 3)
  const courseMarkers = race.course
    ? projection.checkpoints
        .filter((checkpoint) => checkpoint.km >= 0 && checkpoint.km <= race.distanceKm)
        .map((checkpoint) => ({
          name: checkpoint.isFinish ? 'Finish' : checkpoint.name,
          km: checkpoint.km,
          late: checkpoint.marginSec !== null && checkpoint.marginSec < 0,
        }))
    : []

  return createPortal(
    <article id="race-print-report" className="hidden" aria-label="Laporan penuh perlumbaan">
      <header className="report-header">
        <div>
          <p className="report-eyebrow">LEPASCOT / RACE READINESS</p>
          <h1>{race.name || 'Laporan perlumbaan'}</h1>
          <p className="report-subtitle">Laporan unjuran perlumbaan dan persediaan latihan</p>
        </div>
        <div className="report-header-mark">LC</div>
      </header>

      <section className="report-outcome">
        <div>
          <p className="report-label">STATUS COT</p>
          <h2>{VERDICT_LABELS[projection.verdict]}</h2>
          <p>{Math.round(projection.probability * 100)}% anggaran peluang tamat dalam cut-off</p>
        </div>
        <div className="report-outcome-time">
          <p className="report-label">MASA DIJANGKA</p>
          <strong>{formatClock(projection.predictedSec)}</strong>
          <span>Julat {formatHM(projection.rangeLowSec)} hingga {formatHM(projection.rangeHighSec)}</span>
        </div>
      </section>

      <div className="report-overview-grid">
      <div className="report-overview-left">
      <section className="report-section">
        <h2>Butiran race</h2>
        <div className="report-facts">
          <div><span>Tarikh</span><strong>{race.raceDate || 'Belum ditetapkan'}</strong></div>
          <div><span>Profil GPX</span><strong>{race.course?.name ?? 'Tiada'}</strong></div>
          <div><span>Jarak</span><strong>{formatNumber(race.distanceKm, 1)} km</strong></div>
          <div><span>Jumlah pendakian</span><strong>{formatNumber(race.gainM)} m D+</strong></div>
          <div><span>Cut-off</span><strong>{formatClock(race.cutoffSec)}</strong></div>
          <div><span>Terrain</span><strong>{terrain}</strong></div>
          <div><span>Cuaca</span><strong>{weather}</strong></div>
          <div><span>Purata pace</span><strong>{formatPace(projection.avgPaceSec)}</strong></div>
          <div><span>Buffer penamat</span><strong>{finish?.marginSec == null ? 'Tiada COT' : formatHM(finish.marginSec)}</strong></div>
        </div>
      </section>

      {race.course && elevationPaths && (
        <section className="report-section report-profile-section">
          <div className="report-profile-heading">
            <h2>Profil GPX</h2>
            <p>{race.course.name} · {formatNumber(race.course.gainM)} m D+ total</p>
          </div>
          <svg
            className="report-profile-svg"
            viewBox="0 0 720 104"
            role="img"
            aria-label={`Profil elevation ${race.course.name}`}
            preserveAspectRatio="none"
          >
            <line x1="48" y1="15" x2="708" y2="15" stroke="#e3e9e6" strokeWidth="1" />
            <line x1="48" y1="72" x2="708" y2="72" stroke="#cbd7d1" strokeWidth="1" />
            <path d={elevationPaths.area} fill="#e9f1ed" />
            <path d={elevationPaths.line} fill="none" stroke="#276b55" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                {courseMarkers.map((marker) => {
                  const courseKm = (marker.km * race.course!.distanceKm) / race.distanceKm
                  const x = 48 + ((courseKm - elevationPaths.minKm) / Math.max(1, elevationPaths.maxKm - elevationPaths.minKm)) * 660
                  const markerColor = marker.late ? '#b42318' : '#d96b35'
                  return (
                    <g key={`${marker.name}-${marker.km}`}>
                      <line x1={x} y1="15" x2={x} y2="72" stroke={markerColor} strokeWidth="1" strokeDasharray="3 3" />
                      <text x={x} y="12" textAnchor="middle" fill={markerColor} className="report-axis-label">{marker.name}</text>
                    </g>
                  )
                })}
                <text x="43" y="18" textAnchor="end" className="report-axis-label">{formatNumber(elevationPaths.maxElevation)} m</text>
                <text x="43" y="74" textAnchor="end" className="report-axis-label">{formatNumber(elevationPaths.minElevation)} m</text>
            <text x="48" y="88" textAnchor="start" className="report-axis-label">{formatNumber(elevationPaths.minKm, 1)}</text>
            <text x="378" y="88" textAnchor="middle" className="report-axis-label">{formatNumber(elevationPaths.midKm, 1)}</text>
            <text x="708" y="88" textAnchor="end" className="report-axis-label">{formatNumber(elevationPaths.maxKm, 1)}</text>
            <text x="378" y="101" textAnchor="middle" className="report-axis-title">KM</text>
            <text x="7" y="44" textAnchor="middle" transform="rotate(-90 7 44)" className="report-axis-title">Elevasi (m)</text>
          </svg>
        </section>
      )}

      <section className="report-section">
        <h2>Ringkasan latihan Garmin</h2>
        <p className="report-note">
          {summary.activityCount} aktiviti dalam tempoh analisis berakhir {formatShortDate(summary.windowEnd)}.
        </p>
        <div className="report-facts report-facts-compact">
          <div><span>Jarak mingguan purata</span><strong>{formatNumber(summary.weeklyKmAvg, 1)} km</strong></div>
          <div><span>D+ mingguan purata</span><strong>{formatNumber(summary.weeklyAscentAvg)} m</strong></div>
          <div><span>Larian terpanjang</span><strong>{formatNumber(summary.longestEffortKm, 1)} km-effort</strong></div>
          <div><span>Marathon setara</span><strong>{formatClock(summary.marathonEquivalentSec)}</strong></div>
        </div>
      </section>

      <section className="report-section">
        <h2>Kesediaan berbanding keperluan race</h2>
        <table className="report-table">
          <thead><tr><th>Ukuran</th><th>Semasa</th><th>Sasaran</th><th>Status</th></tr></thead>
          <tbody>
            {projection.readinessItems.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>{formatNumber(item.actual, item.unit === 'm' ? 0 : 1)} {item.unit}</td>
                <td>{formatNumber(item.required, item.unit === 'm' ? 0 : 1)} {item.unit}</td>
                <td>{Math.round(Math.min(1, item.actual / item.required) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      </div>

      <div className="report-overview-right">
        <section className="report-section">
          <h2>Checkpoint utama</h2>
          <table className="report-table">
            <thead><tr><th>CP</th><th>Km</th><th>Tiba</th><th>COT</th><th>Buffer</th></tr></thead>
            <tbody>
              {visibleCheckpoints.map((checkpoint) => (
                <tr key={checkpoint.id}>
                  <td>{checkpoint.name}</td>
                  <td>{formatNumber(checkpoint.km, 1)}</td>
                  <td>{formatClock(checkpoint.arrivalSec)}</td>
                  <td>{checkpoint.cutoffSec == null ? '—' : formatClock(checkpoint.cutoffSec)}</td>
                  <td>{checkpoint.marginSec == null ? '—' : formatHM(checkpoint.marginSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {omittedCheckpointCount > 0 && <p className="report-note">+{omittedCheckpointCount} CP lain dalam app</p>}
        </section>
      </div>
      </div>

      <section className="report-section report-all-weeks">
        <h2>Semua minggu latihan hingga race</h2>
        {calendar.status === 'ready' ? (
          <div
            className="report-weeks-grid"
            style={{ gridTemplateRows: `repeat(${weeksPerColumn}, minmax(0, auto))` }}
          >
            {calendar.weeks.map((week) => (
              <div key={week.number} className="report-week-row">
                <strong>W{String(week.number).padStart(2, '0')} · {week.phase}</strong>
                <span>{formatShortDate(week.days[0].date)}–{formatShortDate(week.days[week.days.length - 1].date)}</span>
                <span>{formatNumber(week.weeklyKmTarget, 1)} km · {week.weeklyAscentTargetM == null ? '—' : `${formatNumber(week.weeklyAscentTargetM)} m EG`} · L {formatNumber(week.longRunKm, 1)} km</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="report-note">{calendarStatusMessage}</p>
        )}
      </section>

      <section className="report-section report-priorities">
        <div className="report-two-column">
          <div>
            <h3>Keutamaan</h3>
            <ul>{projection.recommendations.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3>Kekuatan dan race</h3>
            <ul>
              {projection.trainingPlan.strengthSessions.slice(1, 3).map((item) => <li key={item}>{item}</li>)}
              {projection.trainingPlan.raceStrategy.slice(0, 2).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <footer className="report-footer">
        Anggaran ini bukan jaminan keputusan race atau nasihat perubatan. Sesuaikan latihan dengan pengalaman, pemulihan,
        kecederaan dan nasihat jurulatih.
      </footer>
    </article>,
    portalRoot,
  )
}