import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

describe('report workspace wire contract', () => {
  it('normalizes .NET names while retaining agreement identities and disabled selections', async () => {
    const preset = createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', [{
      IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'Equals', Type: 0 }, Values: [{ Name: '42', Value: 42, Data: { Id: 42 } }],
    }])
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: preset.Name, UpdatedAtUtc: '2026-09-07T13:00:00Z', Data: {
      From: preset.Data.from, To: preset.Data.to, Sorted: preset.Data.sorted, Selections: preset.Data.selections, DataSource: 0,
    } }
    vi.mocked(apiRequest).mockResolvedValue([wire])
    const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual({ ...preset.Data, dataSource: 0 })
    vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 3 })
    await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: {
      Id: wire.Id, Revision: 2, Name: wire.Name, Data: template.Data,
    } })
  })
})
