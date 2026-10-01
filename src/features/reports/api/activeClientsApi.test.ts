import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createActiveClientsRequest } from '../data/activeClients'
import { activeClientsCapability, activeClientsReport } from '../data/activeClients.test-fixtures'
import { debtRatioCapability } from '../data/debtToSalesRatio.test-fixtures'
import { getActiveClientsCapabilities, previewActiveClients } from './activeClientsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('uses a dedicated capability and one authenticated month-only preview for cells and XLSX/PDF', async () => {
  const capability = activeClientsCapability(), response = activeClientsReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(response)
  expect(await getActiveClientsCapabilities(controller.signal)).toBe(capability)
  expect(await previewActiveClients(capability, '2026-09')).toBe(response)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/active-clients/capabilities', { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/active-clients/preview', {
    method: 'POST', body: createActiveClientsRequest(capability, '2026-09'), dedupe: false,
  })
  expect(api).toHaveBeenCalledTimes(2)
  expect(response.Cells[2].Value).toBe('33.333333333333333333333333333')
})

it('makes no preview request for a disabled capability or non-month period', async () => {
  await expect(previewActiveClients({ ...activeClientsCapability(), Executable: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewActiveClients(activeClientsCapability(), '2026-09-01')).rejects.toThrow('Оберіть місяць')
  expect(api).not.toHaveBeenCalled()
})

it('refuses another constructor capability and files for a different requested month', async () => {
  api.mockResolvedValueOnce(debtRatioCapability()).mockResolvedValueOnce(activeClientsReport('2026-08'))
  await expect(getActiveClientsCapabilities()).rejects.toThrow('Сервер не підтвердив')
  await expect(previewActiveClients(activeClientsCapability(), '2026-09')).rejects.toThrow('інший місячний період')
})
