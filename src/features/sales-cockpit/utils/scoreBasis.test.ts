import { describe, expect, it } from 'vitest'
import { scoreBasisNote } from './scoreBasis'

describe('scoreBasisNote', () => {
  it('stays silent for a current model score and for tasks without a marker', () => {
    expect(scoreBasisNote({})).toBeNull()
    expect(scoreBasisNote({ payload: {} })).toBeNull()
    expect(scoreBasisNote({ payload: { score_source: 'model', degraded: false, degraded_reason: null } })).toBeNull()
  })

  it('names the rule-based score and its reason', () => {
    expect(scoreBasisNote({ payload: { score_source: 'heuristic', degraded: true, degraded_reason: 'model_head_untrained' } }))
      .toBe('Оцінка за правилом: для цього типу задач модель ще не має достатньо історії.')
    expect(scoreBasisNote({ payload: { score_source: 'heuristic', degraded: true, degraded_reason: 'model_artifact_missing' } }))
      .toBe('Оцінка за правилом: модель прогнозу недоступна.')
    expect(scoreBasisNote({ payload: { score_source: 'heuristic' } })).toBe('Оцінка за правилом, а не прогноз моделі.')
    expect(scoreBasisNote({ payload: { degraded: true, degraded_reason: 'unknown_future_reason' } }))
      .toBe('Оцінка за правилом, а не прогноз моделі.')
  })

  it('marks a stale model without calling it a rule', () => {
    expect(scoreBasisNote({ payload: { score_source: 'model', degraded: true, degraded_reason: 'model_stale' } }))
      .toBe('Прогноз моделі, яку давно не оновлювали.')
  })
})
