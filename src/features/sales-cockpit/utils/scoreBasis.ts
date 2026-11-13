import type { CockpitTask } from '../types'

const HEURISTIC_NOTE: Record<string, string> = {
  model_head_untrained: 'Оцінка за правилом: для цього типу задач модель ще не має достатньо історії.',
  model_head_withheld: 'Оцінка за правилом: модель для цього типу задач не пройшла перевірку якості.',
  model_artifact_missing: 'Оцінка за правилом: модель прогнозу недоступна.',
  model_incompatible: 'Оцінка за правилом: модель прогнозу недоступна.',
}

const HEURISTIC_DEFAULT = 'Оцінка за правилом, а не прогноз моделі.'
const STALE_NOTE = 'Прогноз моделі, яку давно не оновлювали.'

/** Short note for a task whose score is not a current model probability; null otherwise. */
export function scoreBasisNote(task: Pick<CockpitTask, 'payload'>): string | null {
  const payload = task.payload
  if (!payload || typeof payload !== 'object') return null

  const reason = typeof payload.degraded_reason === 'string' ? payload.degraded_reason : null
  if (payload.score_source === 'heuristic') {
    return (reason && HEURISTIC_NOTE[reason]) || HEURISTIC_DEFAULT
  }
  if (payload.score_source === 'model' && reason === 'model_stale') return STALE_NOTE
  if (payload.degraded === true && payload.score_source === undefined) return HEURISTIC_DEFAULT
  return null
}
