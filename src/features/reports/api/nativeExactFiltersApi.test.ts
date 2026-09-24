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
const sourceBuyerSubtree = { Version: 1 as const, SourceWorld: 'fenix' as const,
  BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40' }
const buyerCapability = { Version: 1 as const, SourceWorld: 'fenix' as const,
  BuyerRootId: sourceBuyerSubtree.BuyerRootId, RequiresCompletePeriodLineage: true as const,
  UsesCurrentCapturedHierarchy: true as const }

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

  it('loads the day and organization capability and sends its exact kind and service filter', async () => {
    const { sourceOrganizations: _unused, productClassification: _product, ...base } = netDataset
    void _unused; void _product
    const dayDataset = {
      ...base, DataSource: 35, Name: 'Валовий прибуток GBA за днем та організацією',
      PeriodRequired: true, PeriodSupported: true,
      Groupings: [3, 4].map(Type => ({ Type, Name: `Група ${Type}` })),
      Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: `Показник ${Type}` })),
      Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: `Фільтр ${Type}` })),
    }
    vi.mocked(apiRequest).mockResolvedValue([{ ...dayDataset, ProductClassification: netDataset.productClassification,
      SourceOrganizations: netDataset.sourceOrganizations, SourceBuyerSubtree: buyerCapability }])
    const [available] = await getReportDatasets()
    expect(available.productClassification).toEqual(netDataset.productClassification)
    expect(available.sourceOrganizations).toEqual(netDataset.sourceOrganizations)
    expect(available.sourceBuyerSubtree).toEqual(buyerCapability)
    const request = defaultDatasetRequest(available, '2026-09-01', '2026-09-23')
    request.productClassification = structuredClone(productClassification)
    request.sourceOrganizations = structuredClone(sourceOrganizations)
    request.sourceBuyerSubtree = structuredClone(sourceBuyerSubtree)
    vi.mocked(apiRequest).mockResolvedValue({})
    await createStockReport(request)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({
      body: expect.objectContaining({ dataSource: 35, productClassification, sourceOrganizations, sourceBuyerSubtree }),
    }))
    const invalid = { ...request, sourceOrganizations: { ...sourceOrganizations, SourceWorld: 'Fenix' } }
    await expect(createStockReport(invalid)).rejects.toThrow('Некоректний точний відбір')
    await expect(createStockReport({ ...request, sourceBuyerSubtree: {
      ...sourceBuyerSubtree, BuyerRootId: '00000000000000000000000000000001' } })).rejects.toThrow('Некоректний точний відбір')
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
