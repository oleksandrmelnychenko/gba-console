import { expect, it, vi } from 'vitest'
import type { ReportEntity } from '../types'
import { profitSupplierDataset } from './profitReadMode.test-fixtures'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { resolveBug1274WorkbookFilters, resolvesWorkbookFilters, SUPPLIER_WORKBOOK_FILE, SUPPLIER_WORKBOOK_ORGANIZATIONS,
  SUPPLIER_WORKBOOK_SUPPLIERS, VPARIVANIE_WORKBOOK_FILE, workbookCaption, workbookFiltersNotice, type WorkbookLookup } from './bug1274WorkbookFilters'

const managerDataset = { ...currentVparivanieDataset,
  currentVparivanie: { ...currentVparivanieDataset.currentVparivanie as object, ManagerFilterSupported: true },
  Filters: currentVparivanieDataset.Filters.map(field => field.Type === 60 ? { ...field, Selectable: true } : field) }

function supplierLookup(): WorkbookLookup {
  let id = 700000
  return vi.fn(async (_source: number, field: number, value: string): Promise<ReportEntity[]> => {
    if (field === 0) return [{ Id: '10549', Name: 'ТОВ «АМГ «КОНКОРД» [10549]' }, { Id: '10550', Name: 'Фенікс [10550]' },
      { Id: '10551', Name: 'ФОП Самолюк Алла Дмитрівна [10551]' }, { Id: '10552', Name: 'ФОП Самолюк Юрій Миколайович [10552]' },
      { Id: '10560', Name: 'ХАЗ [10560]' }]
    if (value.startsWith('ПЛА-ТАН')) return []
    if (value === 'КРАФТ СП') return [{ Id: '614521', Name: 'КРАФТ СП\tТОВ [614521]' }]
    const name = SUPPLIER_WORKBOOK_SUPPLIERS.find(item => item === value)
    return name ? [{ Id: String(++id), Name: `${name} [${id}]` }, { Id: String(++id), Name: `${name} (інша картка) [${id}]` }] : []
  })
}

it('resolves the supplier workbook organizations and the saved 1C supplier list by name at runtime', async () => {
  const lookup = supplierLookup()
  const resolved = await resolveBug1274WorkbookFilters(SUPPLIER_WORKBOOK_FILE, profitSupplierDataset, lookup)
  expect(resolved.fileName).toBe(SUPPLIER_WORKBOOK_FILE)
  expect(resolved.selections).toHaveLength(2)
  const [organizations, suppliers] = resolved.selections
  expect(organizations).toMatchObject({ IsChecked: true, SelectedField: { Type: 0 }, FilterCondition: { Type: 2 } })
  expect(organizations.Values.map(value => value.Data.Id)).toEqual(['10549', '10550', '10551', '10552'])
  expect(organizations.Values.every(value => value.Value === 0)).toBe(true)
  expect(suppliers).toMatchObject({ SelectedField: { Type: 17 }, FilterCondition: { Type: 2 } })
  expect(suppliers.Values).toHaveLength(SUPPLIER_WORKBOOK_SUPPLIERS.length - 1)
  expect(suppliers.Values.map(value => value.Name)).toContain('КРАФТ СП\tТОВ [614521]')
  expect(resolved.unresolved).toEqual(['ПЛА-ТАН І К ТОВ'])
  expect(vi.mocked(lookup).mock.calls.filter(call => call[1] === 0)).toEqual([[38, 0, '']])
  expect(vi.mocked(lookup).mock.calls.some(call => call[2] === 'КРАФТ СП')).toBe(true)
  expect(vi.mocked(lookup).mock.calls.every(call => !call[2].includes('\t') && call[2].length <= 120)).toBe(true)
  expect(SUPPLIER_WORKBOOK_ORGANIZATIONS).not.toContain('ФОП Пархоменко Ганна Юріївна')
})

it('refuses ambiguous or failed lookups instead of guessing an identity', async () => {
  const lookup: WorkbookLookup = async (_source, field) => field === 0
    ? [{ Id: '1', Name: 'Фенікс [1]' }, { Id: '2', Name: 'Фенікс [2]' }]
    : Promise.reject(new Error('offline'))
  const resolved = await resolveBug1274WorkbookFilters(SUPPLIER_WORKBOOK_FILE, profitSupplierDataset, lookup)
  expect(resolved.selections.map(selection => selection.SelectedField.Type)).toEqual([])
  expect(resolved.unresolved).toHaveLength(SUPPLIER_WORKBOOK_ORGANIZATIONS.length + SUPPLIER_WORKBOOK_SUPPLIERS.length)
  expect(workbookFiltersNotice(resolved)).toContain('Не знайдено однозначно в GBA')
  expect(workbookFiltersNotice({ ...resolved, unresolved: [] })).toBe('')
  expect(workbookFiltersNotice(undefined)).toBe('')
})

it('resolves the matrix workbook group, buyer and buyer manager by exact current names', async () => {
  const lookup: WorkbookLookup = vi.fn(async (_source: number, field: number, value: string) => field === 4
    ? [{ Id: '3996', Name: 'AL-KO [3996]' }, { Id: '4001', Name: 'AL-KO TRAILER [4001]' }]
    : field === 5 ? [{ Id: '613989', Name: 'АФРАКО ТЗОВ [613989]' }]
    : value === 'Крицький Олег Русланович' ? [{ Id: '5608315DD4C6B3419948F4C603F71C9B', Name: 'Крицький Олег Русланович [10184]' }] : [])
  const resolved = await resolveBug1274WorkbookFilters(VPARIVANIE_WORKBOOK_FILE, managerDataset, lookup)
  expect(resolved.unresolved).toEqual([])
  expect(resolved.selections.map(selection => [selection.SelectedField.Type, selection.FilterCondition.Type,
    selection.Values.map(value => value.Data.Id)])).toEqual([
    [4, 6, ['3996']], [5, 0, ['613989']], [60, 0, ['5608315DD4C6B3419948F4C603F71C9B']]])
  const withoutManager = await resolveBug1274WorkbookFilters(VPARIVANIE_WORKBOOK_FILE, currentVparivanieDataset, lookup)
  expect(withoutManager.selections.map(selection => selection.SelectedField.Type)).toEqual([4, 5])
  expect(withoutManager.unresolved).toEqual(['Крицький Олег Русланович'])
})

it('limits runtime resolution to the two workbooks with printed local filters', () => {
  expect([SUPPLIER_WORKBOOK_FILE, VPARIVANIE_WORKBOOK_FILE, 'ВП.xls', 'ДБіторка.xls'].map(resolvesWorkbookFilters))
    .toEqual([true, true, false, false])
  expect(workbookCaption('КРАФТ СП\tТОВ [614521]')).toBe('КРАФТ СП ТОВ')
  expect(workbookCaption(' ELERTE POLAND SP. Z O. O.  [id=615845] ')).toBe('ELERTE POLAND SP. Z O. O.')
})
