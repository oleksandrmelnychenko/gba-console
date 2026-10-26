import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchDatasetReportValues } from '../api/reportsApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { bug1274DatasetTitle, bug1274WorkbookGuide, bug1274WorkbookPeriod, reportPeriodPresets } from './bug1274WorkbookGuide'
import { resolveBug1274WorkbookFilters } from './bug1274WorkbookFilters'
import { defaultDatasetRequest } from './reportDatasets'
import { BUG_1274_ACTIVE_DATA_SOURCES } from './reportMigration'
import { isNegativePreviewScalar, previewBlanksZero, previewNegativeRed } from './nativeReportPreview'
import { organizationFilterField, workbookDeskTitle } from './workbookDesk'
import { isSalesByResponsiblesDataset, isSalesResponsibleKey, SALES_BY_RESPONSIBLES_WORKBOOK_FILE } from './salesByResponsibles'
import { salesByResponsiblesDataset } from './salesByResponsibles.test-fixtures'
import { usesNativeReportLookup } from './nativeReportProfiles'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const apiRequestMock = vi.mocked(apiRequest)

describe('sales by responsibles workbook', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('opens as an active workbook with the 1C layout and the four synchronized organizations', async () => {
    expect(BUG_1274_ACTIVE_DATA_SOURCES.has(43)).toBe(true)
    expect(isSalesByResponsiblesDataset(salesByResponsiblesDataset)).toBe(true)
    expect(isSalesByResponsiblesDataset({ ...salesByResponsiblesDataset, Groupings: salesByResponsiblesDataset.Groupings.filter(field => field.Type !== 23) })).toBe(false)
    const launch = availableBug1274WorkbookLaunches([salesByResponsiblesDataset]).find(item => item.fileName === SALES_BY_RESPONSIBLES_WORKBOOK_FILE)
    expect(launch?.label).toBe('Продажі по менеджерах')
    expect(workbookDeskTitle(SALES_BY_RESPONSIBLES_WORKBOOK_FILE, 43)).toBe('Продажі по менеджерах')
    expect(bug1274DatasetTitle(43)).toBe('Продажі по менеджерах')
    expect(bug1274WorkbookGuide(SALES_BY_RESPONSIBLES_WORKBOOK_FILE)?.summary).toContain('Пархоменко')
    expect(organizationFilterField(43)).toBe(0)
    expect(usesNativeReportLookup(43)).toBe(true)
    expect(bug1274WorkbookPeriod(SALES_BY_RESPONSIBLES_WORKBOOK_FILE, '2026-10-26')).toEqual({ from: '2026-10-01', to: '2026-10-25' })
    expect(reportPeriodPresets(43, '2026-10-26').map(preset => preset.label)).toEqual(['Вчора', 'Поточний місяць', 'Минулий місяць', 'Поточний рік'])

    const request = defaultDatasetRequest(salesByResponsiblesDataset, '2026-10-01', '2026-10-25')
    expect(request.sorted.Row.map(row => row.type)).toEqual([4, 22])
    expect(request.sorted.Col.map(column => column.type)).toEqual([23])
    expect(request.sorted.Measurements.filter(measure => measure.IsChecked).map(measure => measure.Type)).toEqual([2, 4])

    const organizations = ['ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'ФОП Самолюк Алла Дмитрівна', 'ФОП Самолюк Юрій Миколайович']
    const lookup = vi.fn().mockResolvedValue(organizations.map((Name, index) => ({ Id: String(10561 + index), Name })))
    const resolved = await resolveBug1274WorkbookFilters(SALES_BY_RESPONSIBLES_WORKBOOK_FILE, salesByResponsiblesDataset, lookup)
    expect(lookup).toHaveBeenCalledWith(43, 0, '')
    expect(resolved.unresolved).toEqual([])
    const opened = bug1274WorkbookRequest(request, launch, resolved)
    expect(opened.selections).toHaveLength(1)
    expect(opened.selections[0]).toMatchObject({ SelectedField: { Type: 0 }, FilterCondition: { Type: 2 } })
    expect(opened.selections[0].Values.map(value => value.Name)).toEqual(organizations)
  })

  it('accepts only exact responsible identities from the lookup', async () => {
    for (const key of ['USER:10146', '1C:8456AA2B31EF4AD711EC3E4875DAD026', 'RETURN', 'NO_ORDER', 'UNASSIGNED', 'UNDEFINED'])
      expect(isSalesResponsibleKey(key)).toBe(true)
    for (const key of ['USER:0', 'USER:x', '1C:00000000000000000000000000000000', '1c:8456aa2b31ef4ad711ec3e4875dad026', 'TOTAL', 10146])
      expect(isSalesResponsibleKey(key)).toBe(false)
    apiRequestMock.mockResolvedValue([{ Id: 'RETURN', Name: 'Повернення (без замовлення)' }, { Id: 'USER:10182', Name: 'Мот Вадим Олександрович' }])
    await expect(searchDatasetReportValues(43, 63, { value: ' Мот ', offset: 0, limit: 30 })).resolves.toHaveLength(2)
    expect(apiRequestMock).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
      query: { dataSource: 43, field: 63, value: 'Мот', offset: 0, limit: 30 } }))
    apiRequestMock.mockResolvedValue([{ Id: 'Мот', Name: 'Мот Вадим Олександрович' }])
    await expect(searchDatasetReportValues(43, 63, { value: '', offset: 0, limit: 30 })).rejects.toThrow('некоректні значення')
    apiRequestMock.mockResolvedValue([{ Id: '10561', Name: 'ТОВ «АМГ «КОНКОРД»' }])
    await expect(searchDatasetReportValues(43, 0, { value: '', offset: 0, limit: 30 })).resolves.toEqual([{ Id: '10561', Name: 'ТОВ «АМГ «КОНКОРД»' }])
    apiRequestMock.mockResolvedValue([{ Id: '10561', Name: 'А' }, { Id: '10561', Name: 'Б' }])
    await expect(searchDatasetReportValues(43, 0, { value: '', offset: 0, limit: 30 })).rejects.toThrow('неоднозначні')
  })

  it('prints zero blank and negative amounts red like the 1C option', () => {
    expect(previewBlanksZero('NativeSalesByResponsibles')).toBe(true)
    expect(previewNegativeRed('NativeSalesByResponsibles')).toBe(true)
    expect(previewNegativeRed('NativeDayOrganizationGrossProfit')).toBe(false)
    expect(isNegativePreviewScalar({ Kind: 'decimal', Value: '-12.60', Provenance: 'producerCell' })).toBe(true)
    expect(isNegativePreviewScalar({ Kind: 'decimal', Value: '12.60', Provenance: 'producerCell' })).toBe(false)
    expect(isNegativePreviewScalar({ Kind: 'decimal', Value: '-0', Provenance: 'producerCell' })).toBe(false)
    expect(isNegativePreviewScalar({ Kind: 'null', Value: null, Provenance: 'producerCell' })).toBe(false)
  })
})
