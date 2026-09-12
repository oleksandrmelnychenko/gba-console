import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import type { ReportRequestBody } from '../types'
import { createStockReport } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const productClassification = {
  Version: 1 as const,
  SourceWorld: 0 as const,
  ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0',
  IsService: false,
}
const sourceOrganizations = {
  Version: 1 as const,
  SourceWorld: 'fenix' as const,
  OrganizationIds: ['00000000000000000000000000000001', '00000000000000000000000000000002'],
}

function exactRequest(): ReportRequestBody {
  return {
    ...defaultDatasetRequest(netDataset, '2026-07-01', '2026-07-31'),
    productClassification: structuredClone(productClassification),
    sourceOrganizations: structuredClone(sourceOrganizations),
  }
}

describe('exact Fenix report filter wire contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes the server capability casing without changing exact capability values', async () => {
    const { sourceOrganizations: organizations, ...dataset } = netDataset
    const wire = { ...dataset, SourceOrganizations: organizations }
    vi.mocked(apiRequest).mockResolvedValue([wire])

    const [result] = await getReportDatasets()

    expect(result).toEqual(netDataset)
    expect(result.sourceOrganizations).not.toBe(organizations)
    expect(result.productClassification).not.toBe(netDataset.productClassification)
    expect(result).not.toHaveProperty('SourceOrganizations')
  })

  it.each([
    { productClassification: undefined },
    { sourceOrganizations: undefined },
    { productClassification: { ...(netDataset.productClassification as object), SourceWorld: 1 } },
    { sourceOrganizations: { ...(netDataset.sourceOrganizations as object), MaximumOrganizationIds: 65 } },
    { sourceOrganizations: { ...(netDataset.sourceOrganizations as object), Extra: true } },
  ])('rejects missing or changed exact-filter capability %#', async patch => {
    vi.mocked(apiRequest).mockResolvedValue([{ ...netDataset, ...patch }])
    await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
  })

  it('loads and saves both strict objects without losing casing, order, or false values', async () => {
    const data = exactRequest()
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: 'Daily exact', Data: {
      DataSource: 2, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections,
      ProductClassification: productClassification, SourceOrganizations: sourceOrganizations,
    } }
    vi.mocked(apiRequest).mockResolvedValue([wire])
    const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual({ ...defaultDatasetRequest(netDataset, data.from, data.to),
      ProductClassification: productClassification, SourceOrganizations: sourceOrganizations })
    expect(template.Data.ProductClassification).not.toBe(productClassification)
    expect(template.Data.SourceOrganizations).not.toBe(sourceOrganizations)

    vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 3 })
    await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: {
      Id: wire.Id, Revision: 2, Name: wire.Name, Data: template.Data,
    } })
  })

  it.each([
    { productClassification: { ...productClassification, Extra: true } },
    { productClassification: { ...productClassification, SourceWorld: 1 } },
    { sourceOrganizations: { ...sourceOrganizations, OrganizationIds: [sourceOrganizations.OrganizationIds[0], sourceOrganizations.OrganizationIds[0].toLowerCase()] } },
    { sourceOrganizations: { ...sourceOrganizations, SourceWorld: 'Fenix' } },
  ])('blocks malformed exact filter before generation or template I/O %#', async patch => {
    const data = { ...exactRequest(), ...patch }
    await expect(createStockReport(data)).rejects.toThrow('Некоректний точний відбір')
    await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Revision: 0, Name: 'bad', Data: data })).rejects.toThrow('Некоректний точний відбір')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('rejects duplicate aliases and a native organization selection before I/O', async () => {
    const duplicated = { ...exactRequest(), ProductClassification: structuredClone(productClassification) }
    await expect(createStockReport(duplicated)).rejects.toThrow('задані двічі')
    const selected = exactRequest()
    selected.selections = [{ IsChecked: true, SelectedField: { Name: 'Organization', Type: 0 },
      FilterCondition: { Name: 'Equals', Type: 0 }, Values: [{ Data: { Id: 1 }, Name: '1', Value: 1 }] }]
    await expect(createStockReport(selected)).rejects.toThrow('Не поєднуйте точні організації')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('snapshots both exact objects before awaiting generation', async () => {
    let finish: (value: unknown) => void = () => undefined
    vi.mocked(apiRequest).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const data = exactRequest(), expected = structuredClone(data)
    const generating = createStockReport(data)
    ;(data.productClassification as typeof productClassification).IsService = true
    ;(data.sourceOrganizations as typeof sourceOrganizations).OrganizationIds.reverse()
    expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(expected)
    finish({})
    await generating
  })
})
