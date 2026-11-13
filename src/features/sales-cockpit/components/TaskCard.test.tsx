import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { CockpitTask } from '../types'
import { TaskCard } from './TaskCard'

vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./WhyThisTask', () => ({ WhyThisTask: () => null }))

function renderTask(task: CockpitTask) {
  const noop = () => undefined
  return render(
    <MantineProvider>
      <TaskCard
        canAddNote={false} canComplete={false} canDismiss={false} canSnooze={false} canTakeInProgress={false}
        task={task} onAddNote={noop} onDismiss={noop} onDone={noop} onSnooze={noop} onTakeInProgress={noop}
      />
    </MantineProvider>,
  )
}

it('renders an old debt task with the low urgency badge, the service title and its age band', () => {
  const { container } = renderTask({
    task_key: 'k1', task_type: 'debt_followup', urgency: 'low', status: 'open',
    title: 'Стара заборгованість: узгодити погашення',
    payload: { debt: { lead_days_past_terms: 400, age_band: 'old', grace_days: 3 } },
  })
  expect(screen.getByText('Низький').closest('.app-role-pill')?.className).toContain('is-gray')
  expect(container.querySelector('.cockpit-task')?.className).toContain('is-low')
  expect(screen.getByText('Стара заборгованість: узгодити погашення')).toBeTruthy()
  expect(screen.getByTestId('task-debt-age-band').textContent).toBe('Понад термін: понад 90 днів')
})

it('shows the fresh and aged bands and nothing for other task types', () => {
  const fresh = renderTask({ task_key: 'k2', task_type: 'debt_followup', urgency: 'high', payload: { debt: { age_band: 'fresh', grace_days: 3 } } })
  expect(screen.getByTestId('task-debt-age-band').textContent).toBe('Понад термін: 4–30 днів')
  fresh.unmount()
  const aged = renderTask({ task_key: 'k3', task_type: 'debt_followup', urgency: 'normal', payload: { debt: { age_band: 'aged', grace_days: 3 } } })
  expect(screen.getByTestId('task-debt-age-band').textContent).toBe('Понад термін: 31–90 днів')
  aged.unmount()
  renderTask({ task_key: 'k4', task_type: 'reorder_due', urgency: 'low', payload: { debt: { age_band: 'old' } } })
  expect(screen.queryByTestId('task-debt-age-band')).toBeNull()
})
