import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import fixture from '../data/customerGroups.quantity-server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

it('renders the actual source44 HTTP response with unknown quantities, known empty zero and independent money intact', async () => {
  const api = vi.mocked(apiRequest)
  api.mockResolvedValue([{ Id: 'quantity-fixture', Revision: 1, Name: 'Порівняння', Data: fixture.request }])
  const [template] = await getServerReportTemplates()
  api.mockResolvedValue(fixture.response)
  const { preview } = await previewStockReport(template.Data)
  expect(preview.Cells).toEqual(fixture.response.Preview.Cells)
  const view = render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={template.Data} /></MantineProvider>)
  const descriptions = 'Без підтвердженої одиниці документа кількість та її відхилення не визначено.'
  const row = view.container.querySelector('tbody tr:not(.report-inline-preview__group-total)')!
  const cells = [...row.querySelectorAll('td')]
  expect(cells).toHaveLength(12)
  for (const index of [0, 1, 7]) {
    expect(cells[index].textContent).toBe('∅')
    expect(cells[index].getAttribute('aria-description')).toBe(descriptions)
  }
  for (const index of [2, 8]) {
    expect(cells[index].textContent).toBe('∅')
    expect(cells[index].getAttribute('aria-description')).toBeNull()
  }
  expect(cells[6].textContent).toBe('0')
  expect(cells[6].getAttribute('aria-description')).toBeNull()
  expect(cells[3].textContent).toBe('60,00')
  expect(screen.queryByText(/Грошові показники розраховано окремо/)).toBeNull()
  for (const index of [5, 11]) expect(cells[index].getAttribute('aria-description')).toBeNull()
})
