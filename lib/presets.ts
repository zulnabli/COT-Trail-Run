import type { RaceConfig, RaceType } from './projection'

export type RacePreset = { id: string; label: string; config: RaceConfig }

const h = (hours: number) => Math.round(hours * 3600)

export const PRESETS: Record<RaceType, RacePreset[]> = {
  marathon: [
    {
      id: 'road-42',
      label: 'Marathon 42K',
      config: {
        type: 'marathon',
        name: 'Marathon Jalan Raya',
        distanceKm: 42.195,
        gainM: 150,
        cutoffSec: h(6),
        terrain: 'road',
        weather: 'hot-humid',
        stopMinPerCp: 0,
        checkpoints: [
          { id: 'm-cp1', name: 'Km 21', km: 21.1, cutoffSec: h(3) },
          { id: 'm-cp2', name: 'Km 32', km: 32, cutoffSec: h(4.5) },
        ],
        course: null,
      },
    },
    {
      id: 'hilly-42',
      label: 'Marathon Berbukit',
      config: {
        type: 'marathon',
        name: 'Marathon Berbukit',
        distanceKm: 42.195,
        gainM: 650,
        cutoffSec: h(7),
        terrain: 'road',
        weather: 'hot-humid',
        stopMinPerCp: 0,
        checkpoints: [],
        course: null,
      },
    },
    {
      id: 'road-21',
      label: 'Half Marathon',
      config: {
        type: 'marathon',
        name: 'Half Marathon',
        distanceKm: 21.0975,
        gainM: 80,
        cutoffSec: h(3.5),
        terrain: 'road',
        weather: 'hot-humid',
        stopMinPerCp: 0,
        checkpoints: [],
        course: null,
      },
    },
  ],
  ultra: [
    {
      id: 'trail-50',
      label: 'Trail 50K',
      config: {
        type: 'ultra',
        name: 'Ultra Trail 50K',
        distanceKm: 50,
        gainM: 2500,
        cutoffSec: h(14),
        terrain: 'trail-technical',
        weather: 'hot-humid',
        stopMinPerCp: 5,
        checkpoints: [
          { id: 'u50-cp1', name: 'CP1', km: 15, cutoffSec: h(4) },
          { id: 'u50-cp2', name: 'CP2', km: 28, cutoffSec: h(7.5) },
          { id: 'u50-cp3', name: 'CP3', km: 40, cutoffSec: h(11) },
        ],
        course: null,
      },
    },
    {
      id: 'trail-100',
      label: 'Ultra 100K',
      config: {
        type: 'ultra',
        name: 'Ultra Trail 100K',
        distanceKm: 100,
        gainM: 5000,
        cutoffSec: h(30),
        terrain: 'trail-technical',
        weather: 'hot-humid',
        stopMinPerCp: 8,
        checkpoints: [
          { id: 'u100-cp1', name: 'CP1', km: 22, cutoffSec: h(5.5) },
          { id: 'u100-cp2', name: 'CP2', km: 45, cutoffSec: h(12) },
          { id: 'u100-cp3', name: 'CP3', km: 68, cutoffSec: h(19.5) },
          { id: 'u100-cp4', name: 'CP4', km: 85, cutoffSec: h(25) },
        ],
        course: null,
      },
    },
    {
      id: 'trail-160',
      label: '100 Batu',
      config: {
        type: 'ultra',
        name: 'Ultra Trail 100 Batu',
        distanceKm: 161,
        gainM: 8500,
        cutoffSec: h(48),
        terrain: 'trail-technical',
        weather: 'hot-humid',
        stopMinPerCp: 12,
        checkpoints: [
          { id: 'u160-cp1', name: 'CP1', km: 30, cutoffSec: h(8) },
          { id: 'u160-cp2', name: 'CP2', km: 60, cutoffSec: h(17) },
          { id: 'u160-cp3', name: 'CP3', km: 95, cutoffSec: h(28) },
          { id: 'u160-cp4', name: 'CP4', km: 130, cutoffSec: h(38.5) },
        ],
        course: null,
      },
    },
  ],
}
