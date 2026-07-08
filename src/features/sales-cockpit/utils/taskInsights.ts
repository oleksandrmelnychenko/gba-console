import type { CockpitTask } from '../types'

const KYIV_TZ = 'Europe/Kyiv'

const kyivDayFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: KYIV_TZ,
  year: 'numeric',
})

const URGENCY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

export type CockpitTaskInsights = {
  averageProbability: number | null
  criticalCount: number
  expectedValueEur: number
  highCount: number
  inProgressCount: number
  openCount: number
  slaBreachedCount: number
  todayCount: number
  topTask: CockpitTask | null
  totalCount: number
  weightedValueEur: number
}

export function kyivDayKey(value: Date): string {
  return kyivDayFormatter.format(value)
}

export function isCockpitTaskToday(task: CockpitTask, todayKey: string): boolean {
  const raw = task.due_date ?? task.generated_at
  if (!raw) {
    return false
  }

  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) {
    return false
  }

  return kyivDayKey(new Date(parsed)) === todayKey
}

export function buildCockpitTaskInsights(tasks: CockpitTask[], todayKey: string): CockpitTaskInsights {
  let criticalCount = 0
  let highCount = 0
  let inProgressCount = 0
  let openCount = 0
  let probabilityCount = 0
  let probabilitySum = 0
  let slaBreachedCount = 0
  let todayCount = 0
  let expectedValueEur = 0
  let weightedValueEur = 0
  let topScore = Number.NEGATIVE_INFINITY
  let topTask: CockpitTask | null = null

  for (const task of tasks) {
    if (task.urgency === 'critical') {
      criticalCount += 1
    } else if (task.urgency === 'high') {
      highCount += 1
    }

    if (task.status === 'in_progress') {
      inProgressCount += 1
    } else if (task.status === 'open' || task.status === 'generated') {
      openCount += 1
    }

    if (task.sla_breached) {
      slaBreachedCount += 1
    }

    if (isCockpitTaskToday(task, todayKey)) {
      todayCount += 1
    }

    const expectedValue = readFiniteNumber(task.expected_value)
    const probability = readFiniteNumber(task.p_outcome)
    const evScore = readFiniteNumber(task.ev_score)

    if (expectedValue !== null) {
      expectedValueEur += expectedValue
    }

    if (expectedValue !== null && probability !== null) {
      weightedValueEur += expectedValue * probability
    }

    if (probability !== null) {
      probabilitySum += probability
      probabilityCount += 1
    }

    const score = evScore ?? taskScore(task, expectedValue, probability)
    if (score > topScore) {
      topScore = score
      topTask = task
    }
  }

  return {
    averageProbability: probabilityCount > 0 ? probabilitySum / probabilityCount : null,
    criticalCount,
    expectedValueEur,
    highCount,
    inProgressCount,
    openCount,
    slaBreachedCount,
    todayCount,
    topTask,
    totalCount: tasks.length,
    weightedValueEur,
  }
}

function taskScore(task: CockpitTask, expectedValue: number | null, probability: number | null): number {
  const urgency = task.urgency ? URGENCY_WEIGHT[task.urgency] ?? 0 : 0
  const priority = readFiniteNumber(task.priority) ?? 0
  const value = expectedValue !== null && probability !== null ? expectedValue * probability : expectedValue ?? 0
  const slaBoost = task.sla_breached ? 10_000 : 0

  return slaBoost + urgency * 1_000 + priority * 10 + value
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
