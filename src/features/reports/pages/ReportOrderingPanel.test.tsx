import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { orderedAccountDataset, orderedAccountRequest } from '../data/reportOrdering.test-fixtures'
import { ReportOrderingPanel } from './ReportOrderingPanel'

it('shows one correction message when ordering has no enabled measure', () => {
  const request = orderedAccountRequest()
  request.sorted.Measurements = request.sorted.Measurements.map(measure => ({ ...measure, IsChecked: false }))

  render(<MantineProvider env="test">
    <ReportOrderingPanel data={request} dataset={orderedAccountDataset} disabled={false} onChange={vi.fn()} />
  </MantineProvider>)

  const panel = within(screen.getByRole('region', { name: 'Сортування значень груп' }))
  expect(panel.getByText(/виберіть один увімкнений показник/)).toBeTruthy()
  expect(panel.queryByText('Спочатку увімкніть показник у налаштуваннях звіту.')).toBeNull()
})
