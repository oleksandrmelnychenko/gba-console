import { describe, expect, it } from 'vitest'
import { normalizeAiHistoryLineage } from './aiHistoryLineage'

const createError = (path: string, reason: string) => new Error(`${path}: ${reason}`)

describe('normalizeAiHistoryLineage', () => {
  it('accepts a complete requested window and preserves its proof', () => {
    expect(
      normalizeAiHistoryLineage(
        {
          source_history_start: '2025-01-01',
          requested_start: '2025-07-25',
          effective_start: '2025-07-25',
          effective_history_days: 365,
          history_complete: true,
          history_not_applicable: ['inventory', 'reservations'],
        },
        'response',
        createError,
        {
          asOf: '2026-07-25',
          requireEffectiveHistoryDays: true,
          requireRequestedStart: true,
          requiredHistoryNotApplicable: ['inventory', 'reservations'],
        },
      ),
    ).toEqual({
      source_history_start: '2025-01-01',
      requested_start: '2025-07-25',
      effective_start: '2025-07-25',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations'],
    })
  })

  it('accepts a source-clamped window and rejects a false completeness claim', () => {
    const value = {
      source_history_start: '2025-01-01',
      requested_start: '2024-07-25',
      effective_start: '2025-01-01',
      history_complete: false,
    }

    expect(
      normalizeAiHistoryLineage(value, 'response', createError, {
        asOf: '2026-07-25',
        requireRequestedStart: true,
      }),
    ).toMatchObject({ effective_start: '2025-01-01', history_complete: false })

    expect(() =>
      normalizeAiHistoryLineage({ ...value, history_complete: true }, 'response', createError, {
        asOf: '2026-07-25',
        requireRequestedStart: true,
      }),
    ).toThrow(/history_complete/)
  })

  it.each([
    ['invalid source date', { source_history_start: '2025-02-31' }],
    ['inverted effective date', { effective_start: '2024-12-31' }],
    ['wrong effective day count', { effective_history_days: 364 }],
  ])('rejects %s', (_name, override) => {
    expect(() =>
      normalizeAiHistoryLineage(
        {
          source_history_start: '2025-01-01',
          effective_start: '2025-07-25',
          effective_history_days: 365,
          history_complete: true,
          ...override,
        },
        'response',
        createError,
        { asOf: '2026-07-25', requireEffectiveHistoryDays: true },
      ),
    ).toThrow()
  })
})
