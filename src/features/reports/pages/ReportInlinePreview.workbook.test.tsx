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
