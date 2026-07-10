import { describe, expect, it } from 'vitest'
import type { AiFleetAnalytics } from './aiFleetView'
import {
  appendAiFleetObservation,
  buildAiFleetObservation,
  buildAiFleetSessionSeries,
  type AiFleetObservation,
} from './aiFleetObservations'

describe('aiFleetObservations', () => {
  it('captures effective API and warmup states without storing service payloads', () => {
    const observation = buildAiFleetObservation(buildAnalytics(), 60_000)

    expect(observation).toEqual({
      capturedAtMs: 60_000,
      services: [
        { health: 'pass', serviceId: 'products', warmup: 'pass' },
        { health: 'fail', serviceId: 'nba', warmup: 'warning' },
      ],
    })
  })

  it('replaces samples in the same polling bucket and keeps a bounded ring', () => {
    const first = buildObservation(1_000, 'pass')
    const replacement = buildObservation(29_000, 'fail')
    const secondBucket = buildObservation(31_000, 'pass')

    let history = appendAiFleetObservation([], first, 30_000, 2)
    history = appendAiFleetObservation(history, replacement, 30_000, 2)
    history = appendAiFleetObservation(history, secondBucket, 30_000, 2)
    history = appendAiFleetObservation(history, buildObservation(61_000, 'warning'), 30_000, 2)

    expect(history).toEqual([secondBucket, buildObservation(61_000, 'warning')])
  })

  it('inserts a null break when observations have a polling gap', () => {
    const series = buildAiFleetSessionSeries([
      buildObservation(0, 'pass'),
      buildObservation(30_000, 'fail'),
      buildObservation(150_000, 'unknown'),
    ])

    expect(series).toEqual([
      expect.objectContaining({ capturedAtMs: 0, pass: 2, total: 2 }),
      expect.objectContaining({ capturedAtMs: 30_000, fail: 1, pass: 1 }),
      { capturedAtMs: 90_000, fail: null, pass: null, total: null, unknown: null, warning: null },
      expect.objectContaining({ capturedAtMs: 150_000, pass: 1, unknown: 1 }),
    ])
  })

  it('ignores empty, invalid and out-of-order observations', () => {
    const history = [buildObservation(60_000, 'pass')]

    expect(appendAiFleetObservation(history, { capturedAtMs: Number.NaN, services: [] })).toBe(history)
    expect(appendAiFleetObservation(history, buildObservation(30_000, 'fail'))).toBe(history)
  })
})

function buildObservation(capturedAtMs: number, warmup: 'fail' | 'pass' | 'unknown' | 'warning'): AiFleetObservation {
  return {
    capturedAtMs,
    services: [{ health: 'pass', serviceId: 'products', warmup }],
  }
}

function buildAnalytics(): AiFleetAnalytics {
  return {
    apiBreakdown: { fail: 1, pass: 1, total: 2, unknown: 0, warning: 0 },
    healthDistribution: { down: 1, healthy: 1, unknown: 0 },
    nextActions: [],
    operationAgeHours: 1,
    operationAgeState: 'pass',
    operationDurationMinutes: 5,
    operationDurationState: 'pass',
    passedCheckCount: 2,
    readinessRows: [
      {
        healthCheckState: 'pass',
        healthState: 'healthy',
        isStaleWarmup: false,
        readinessPercent: 100,
        serviceId: 'products',
        serviceName: 'gba-products',
        source: 'ProductsApi',
        warmupAgeHours: 1,
        warmupCheckState: 'pass',
        warmupState: 'healthy',
      },
      {
        healthCheckState: 'fail',
        healthState: 'down',
        isStaleWarmup: true,
        readinessPercent: 0,
        serviceId: 'nba',
        serviceName: 'gba-nba',
        source: 'GbaNbaApi',
        warmupAgeHours: 31,
        warmupCheckState: 'warning',
        warmupState: 'healthy',
      },
    ],
    staleWarmupCount: 1,
    totalCheckCount: 4,
    totalReadinessPercent: 50,
    warmupBreakdown: { fail: 0, pass: 1, total: 2, unknown: 0, warning: 1 },
    warmupDistribution: { down: 0, healthy: 1, unknown: 1 },
  }
}
