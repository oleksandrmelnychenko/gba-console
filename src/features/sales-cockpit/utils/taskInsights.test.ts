import { describe, expect, it } from 'vitest'
import type { CockpitTask } from '../types'
import { buildCockpitTaskInsights, isCockpitTaskToday, kyivDayKey } from './taskInsights'

describe('taskInsights', () => {
  it('counts queue state and ranks the highest operational task', () => {
    const todayKey = '2026-07-08'
    const tasks: CockpitTask[] = [
      {
        task_key: 'low',
        due_date: '2026-07-08T08:00:00Z',
        expected_value: 300,
        p_outcome: 0.5,
        priority: 2,
        status: 'open',
        urgency: 'normal',
      },
      {
        task_key: 'critical-sla',
        due_date: '2026-07-07T08:00:00Z',
        expected_value: 100,
        p_outcome: 0.25,
        priority: 1,
        sla_breached: true,
        status: 'in_progress',
        urgency: 'critical',
      },
      {
        task_key: 'score-wins',
        due_date: '2026-07-08T12:00:00Z',
        ev_score: 50_000,
        expected_value: 700,
        p_outcome: 0.75,
        status: 'generated',
        urgency: 'high',
      },
    ]

    expect(buildCockpitTaskInsights(tasks, todayKey)).toEqual({
      averageProbability: 0.5,
      criticalCount: 1,
      expectedValueEur: 1_100,
      highCount: 1,
      inProgressCount: 1,
      openCount: 2,
      slaBreachedCount: 1,
      todayCount: 2,
      topTask: tasks[2],
      totalCount: 3,
      weightedValueEur: 700,
    })
  })

  it('uses Kyiv calendar dates for today detection', () => {
    const date = new Date('2026-07-07T21:30:00Z')
    const task: CockpitTask = {
      generated_at: '2026-07-07T21:30:00Z',
      task_key: 'kyiv-midnight',
    }

    expect(kyivDayKey(date)).toBe('2026-07-08')
    expect(isCockpitTaskToday(task, '2026-07-08')).toBe(true)
  })
})
