import { expect, it } from 'vitest'
import { currentVparivanieConfigurationError, currentVparivanieFullScopeAvailable,
  CURRENT_VPARIVANIE_FULL_NOTE, CURRENT_VPARIVANIE_FULL_TITLE } from './currentVparivanie'
import { currentVparivanieDataset, currentVparivanieRequest, currentVparivaniePreview, exactSelection } from './currentVparivanie.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { normalizeCurrentVparivanieRegional } from './currentVparivanieRegional'
import { regionalRequest, regionalResult } from './currentVparivanieRegional.test-fixtures'
import { buildSpreadsheetSheet, buildSheetExportRows, parseDelimitedText } from '../spreadsheet'
import { CURRENT_VPARIVANIE_DISPLAY_LINE } from './currentVparivanieSpreadsheet'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from './currentVparivanie'
import { retainStoredTemplateFields } from './reportTemplateDraft'

const dataset = { ...currentVparivanieDataset, currentVparivanie: { ...(currentVparivanieDataset.currentVparivanie as object),
  FullScopeVersion: 1, FullScopeContract: 'OneOurSnapshotCompleteSelectedScope', FullScopeMaximumRows: 500000,
  FullScopeMaximumSelectedProducts: 4096, FullScopeMaximumColumns: 256, FullScopeMaximumAddressedCells: 1000000 } }

it('negotiates the complete selection independently from the retained bounded capability', () => {
  expect(currentVparivanieFullScopeAvailable(currentVparivanieDataset)).toBe(false)
  expect(currentVparivanieFullScopeAvailable(dataset)).toBe(true)
  const request = { ...currentVparivanieRequest(), currentVparivanieFullScope: true,
    selections: [exactSelection(1, 2, Array.from({ length: 257 }, (_, i) => String(i + 1)))] }
  expect(currentVparivanieConfigurationError(request, dataset)).toBeNull()
  expect(currentVparivanieConfigurationError(request, currentVparivanieDataset)).toContain('не підтримує')
  expect(currentVparivanieConfigurationError({ ...request, currentVparivanieFullScope: undefined }, dataset)).not.toBeNull()
})

it.each([false, null, 'true', 1])('refuses a noncanonical full scope mode %s', value => {
  expect(currentVparivanieConfigurationError({ ...currentVparivanieRequest(), currentVparivanieFullScope: value }, dataset)).not.toBeNull()
})

it('refuses duplicate or foreign mode and allows deliberately clearing a saved full mode', () => {
  const request = { ...currentVparivanieRequest(), currentVparivanieFullScope: true }
  expect(currentVparivanieConfigurationError({ ...request, CurrentVparivanieFullScope: true }, dataset)).not.toBeNull()
  expect(currentVparivanieConfigurationError({ ...request, dataSource: 2 })).not.toBeNull()
  expect(retainStoredTemplateFields(request, currentVparivanieRequest()).currentVparivanieFullScope).toBeUndefined()
})

it('requires the full preview version and complete note before accepting more than 128 products', () => {
  const preview = currentVparivaniePreview()
  preview.CurrentVparivanieProducts.Version = 2
  preview.Page.TotalVisibleRows = 257; preview.Page.HasMore = true
  preview.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  const result = normalizeNativeReportPreview({ Preview: preview }, true)
  expect(result.CurrentVparivanieProducts?.Version).toBe(2)
  expect(result.Page.TotalVisibleRows).toBe(257)
  expect(result.CurrentVparivanieProducts?.Rows[0].Article).toBe('0000123')
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow('непідтверджені')
  preview.CurrentVparivanieProducts.Version = 1
  expect(() => normalizeNativeReportPreview({ Preview: preview }, true)).toThrow('непідтверджені')
})

it('keeps preview and full export footprint resource refusal explicit', () => {
  const preview = currentVparivaniePreview(); preview.CurrentVparivanieProducts.Version = 2
  preview.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  preview.Page.TotalVisibleRows = 500000; preview.Page.HasMore = true
  expect(() => normalizeNativeReportPreview({ Preview: preview }, true)).toThrow('непідтверджені')
})

it('requires the own complete regional marker while keeping current version 3 and exact quantities', () => {
  const request = { ...regionalRequest(), currentVparivanieFullScope: true }
  const result = { ...regionalResult(), FullScopeVersion: 1 }
  result.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  expect(normalizeCurrentVparivanieRegional(result, request).Rows[0].Cells[0].Quantity).toBe('9007199254740993.00000001')
  expect(() => normalizeCurrentVparivanieRegional(result, regionalRequest())).toThrow('неповну')
  expect(() => normalizeCurrentVparivanieRegional(regionalResult(), request)).toThrow('неповну')
})

it('reads and reexports every full workbook row with text identity and null quantity intact', () => {
  const rows = [[CURRENT_VPARIVANIE_FULL_TITLE], ['Період: 01.09.2026 – 27.09.2026'], ['Рядки: Товар'],
    ['Колонки: Группа, Контрагент'], ['Показники: Результат'], [CURRENT_VPARIVANIE_DISPLAY_LINE],
    [`! ${CURRENT_VPARIVANIE_FULL_NOTE}`], [],
    [null,null,null,null,null,null,null,'Остатки','Продажи'],
    [null,null,null,null,null,null,null,'',''],
    [...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS,'Результат','Результат'],
    ...Array.from({ length: 257 }, (_, i) => [`0000${i}`,`Product ${i}`,'',null,null,null,null,i === 0 ? null : i,-i])]
  const sheet = buildSpreadsheetSheet('Full', rows)
  expect(sheet.rows).toHaveLength(257); expect(sheet.rows[0].cells[7]).toBeNull()
  const exported = buildSheetExportRows(sheet, sheet.rows)
  const csv = exported.map(row => row.map(cell => cell == null ? '' : `"${String(cell).replaceAll('"','""')}"`).join(';')).join('\n')
  const restored = buildSpreadsheetSheet('Full', parseDelimitedText(csv, ';'), 'flat')
  expect(restored.rows).toHaveLength(257);expect(restored.rows[256].cells[0]).toBe('0000256')
  rows[0] = ['Впарювання: поточні залишки та продажі GBA']
  expect(() => buildSpreadsheetSheet('Bounded', rows)).toThrow('Некоректний файл')
})

it('refuses a full workbook without its EOF attribution', () => {
  expect(() => buildSpreadsheetSheet('Incomplete', [[CURRENT_VPARIVANIE_FULL_TITLE], ['Рядки: Товар'],
    ['Колонки: Группа, Контрагент'], [], ['Артикул','Результат'], ['A',1]])).toThrow('Некоректний файл')
})
