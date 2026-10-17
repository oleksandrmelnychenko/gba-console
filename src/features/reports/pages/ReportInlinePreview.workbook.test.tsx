import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { workbookPreview } from '../data/workbookPresentation.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

it('appends selected currency/kind values to the account caption like 1C «Разом з вимірами» while leaving explicit financialNULL unchanged', () => {
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: workbookPreview() })} /></MantineProvider>)
  expect(screen.getByRole('rowheader', { name: 'Каса №1, Гривня (UAH), Каса' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: /, Валюта рахунку \(каси\), Вид коштів$/ })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '∅' })).toBeTruthy()
  expect(screen.queryByRole('columnheader', { name: 'Основний менеджер покупця' })).toBeNull()
})
it('renders only selected manager columns, preserves padded descriptions and distinguishes explicit unassigned', () => {
  const raw = workbookPreview(); raw.Request.DataSource = 'NativeSettlementPeriod'
  raw.RowSchema = [{ Identity: 'Organization', Caption: 'Організація' }, { Identity: 'SettlementCounterparty', Caption: 'Контрагент' }]
  raw.Rows[0].Values = [{ Caption: 'Організація' }, { Caption: 'Покупець' }]
  raw.workbookPresentation.selection.additionalFields = [60]
  raw.workbookPresentation.fields = [{ type: 60, caption: 'Основний менеджер покупця', placement: 'column' }]
  raw.workbookPresentation.rows[0].values = [{ type: 60, state: 'null', values: [], inputSha256: 'c'.repeat(64) }]
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: raw })} /></MantineProvider>)
  expect(screen.getByRole('columnheader', { name: 'Основний менеджер покупця' })).toBeTruthy()
  expect(screen.queryByRole('columnheader', { name: 'Код по региону' })).toBeNull()
  expect(screen.getByRole('rowheader', { name: '∅' })).toBeTruthy()
})
it('keeps retained day settings outside row product columns and displays the explicit month ordering', () => {
  const raw = workbookPreview(); raw.Request.DataSource = 'NativeDayOrganizationGrossProfit'
  raw.RowSchema = [{ Identity: 'Day', Caption: 'День' }, { Identity: 'Organization', Caption: 'Організація' }]
  raw.Rows[0].Values = [{ Caption: '01.10.2026' }, { Caption: 'Організація' }]
  raw.workbookPresentation.selection = { version: 1, additionalFields: [2], ordering: 'MonthAscending' }
  raw.workbookPresentation.fields = [{ type: 2, caption: 'Артикул', placement: 'retainedSetting' }]; raw.workbookPresentation.rows = []
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: raw })} /></MantineProvider>)
  expect(screen.getByText(/Додаткові поля книги: Артикул\. Як і в 1С, у рядках «день \/ організація» вони не заповнюються/)).toBeTruthy()
  expect(screen.getByText('Сортування: по місяцях (за зростанням), як у книзі 1С.')).toBeTruthy()
  expect(screen.queryByRole('columnheader', { name: 'Артикул' })).toBeNull()
})
it('prints each cash desk in its own currency without the id unless two records would print the same caption', () => {
  const raw = workbookPreview()
  const records = [['Каса А [41754]', 'USD'], ['Каса А [41755]', 'EUR'], ['Каса П [41761]', 'USD'], ['Каса П [41762]', 'USD']] as const
  raw.RowSchema = [{ Identity: 'PaymentBalanceRecord', Caption: 'Каса / рахунок' }]
  raw.Rows = records.map(([caption], index) => ({ Ordinal: index, SourceIndex: 12 + index, Values: [{ Caption: caption }] }))
  raw.Cells = records.map((_, index) => ({ RowSourceIndex: 12 + index, ColumnSourceIndex: 0,
    Value: { Kind: 'null' as const, Value: null, Provenance: 'producerCell' } }))
  raw.Page = { ...raw.Page, TotalVisibleRows: records.length, ReturnedRows: records.length }
  raw.workbookPresentation.rows = records.map(([, currency], index) => ({ rowSourceIndex: 12 + index,
    rowKeySha256: String(index + 1).repeat(64), values: [{ type: 30, state: 'known' as const, values: [currency], inputSha256: null },
      { type: 33, state: 'known' as const, values: ['Каса'], inputSha256: null }],
    currencyWitnesses: [{ id: String(index + 1), netUid: `0000000${index + 1}-2222-3333-4444-555555555555`, name: currency, code: null, available: true }] }))
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: raw })} /></MantineProvider>)
  expect(screen.getByRole('rowheader', { name: 'Каса А, USD, Каса' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Каса А, EUR, Каса' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Каса П [41761], USD, Каса' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Каса П [41762], USD, Каса' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Каса / рахунок, Валюта рахунку (каси), Вид коштів' })).toBeTruthy()
})
