import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCashMovementArticleChoices, previewCashMovement } from '../api/cashMovementApi'
import type { CashMovementKind } from '../data/cashMovement'
import { createCashMovementArticleChoicesRequest } from '../data/cashMovementArticleChoices'
import { CASH_MOVEMENT_TEST_ARTICLE, cashMovementArticleChoices, cashMovementCapability, cashMovementEmptyReport, cashMovementFilteredReport, cashMovementReport } from '../data/cashMovement.test-fixtures'
import type { ReportDocument } from '../types'
import { CashMovementReportPanel } from './CashMovementReportPanel'
vi.mock('../api/cashMovementApi', () => ({ getCashMovementArticleChoices: vi.fn(), previewCashMovement: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
  ? <div role="dialog" aria-label="Файли відбору"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
function panel(kind: CashMovementKind = 'receipts', callerKey = 'owner-a', canGenerate = true) {
  return <MantineProvider env="test"><I18nProvider><CashMovementReportPanel capability={cashMovementCapability(kind)} initialMonth="2026-09"
    callerKey={callerKey} canGenerate={canGenerate} /></I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.mocked(getCashMovementArticleChoices).mockReset(); vi.mocked(previewCashMovement).mockReset()
  vi.mocked(getCashMovementArticleChoices).mockImplementation(async (capability, period) => ({
    ...cashMovementArticleChoices(capability.Periodicity === 'Quarter' ? 'receipts' : 'payouts', period), ...createCashMovementArticleChoicesRequest(capability, period),
  }))
  vi.mocked(previewCashMovement).mockImplementation(async (capability, period, _caller, _signal, key) => key
    ? cashMovementFilteredReport(capability.Periodicity === 'Quarter' ? 'receipts' : 'payouts', period)
    : cashMovementReport(capability.Periodicity === 'Quarter' ? 'receipts' : 'payouts', period))
})
it.each(['receipts', 'payouts'] as const)('uses genuine optional %s article labels, four server columns and same-run files', async kind => {
  render(panel(kind)); const select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  expect((select as HTMLSelectElement).value).toBe('')
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const files = await screen.findByRole('dialog', { name: 'Файли відбору' }), report = cashMovementFilteredReport(kind)
  expect(previewCashMovement).toHaveBeenCalledWith(cashMovementCapability(kind), report.Period, 'owner-a', expect.any(AbortSignal), CASH_MOVEMENT_TEST_ARTICLE)
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  const result = screen.getByRole('region', { name: 'Результат руху коштів' })
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Тестовий контрагент', '4', '3', '33.33', '1', '4', '3', '33.33', '1'])
  expect(within(result).getByText(/Стаття руху коштів:/).textContent).toContain(report.ArticleFilter!.Caption)
  expect(screen.queryByText(report.ArticleFilter!.BindingSha256)).toBeNull(); expect(screen.queryByText(CASH_MOVEMENT_TEST_ARTICLE)).toBeNull()
})
it('does not select a first article or add an optional filter to the default report', async () => {
  render(panel()); await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByRole('region', { name: 'Результат руху коштів' })
  expect(previewCashMovement).toHaveBeenCalledWith(cashMovementCapability(), '2026-Q3', 'owner-a', expect.any(AbortSignal), null)
})
it('shows a complete empty selected result separately from missing publications and preserves NULL totals', async () => {
  vi.mocked(previewCashMovement).mockResolvedValueOnce({ ...cashMovementEmptyReport(), ArticleFilter: cashMovementFilteredReport().ArticleFilter })
  render(panel()); const select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } }); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає руху коштів.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')).toBeNull()
})
it('preserves unfiltered generation while the complete normal identity for article choices is still missing', async () => {
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce({ ...cashMovementArticleChoices(), Available: false, Code: 'cash_article_normal_identity_unavailable', Choices: [] })
  render(panel()); await screen.findByText('Список статей за вибрані періоди ще не готовий. Звіт без відбору за статтею доступний.')
  expect(screen.queryByRole('combobox')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат руху коштів' }); expect(previewCashMovement).toHaveBeenCalledOnce()
})
it('allows an unfiltered report when the independent choices request fails', async () => {
  vi.mocked(getCashMovementArticleChoices).mockRejectedValueOnce(new Error('Список тимчасово недоступний'))
  render(panel()); await screen.findByText('Список тимчасово недоступний')
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByRole('region', { name: 'Результат руху коштів' })
  expect(previewCashMovement).toHaveBeenCalledOnce()
})
it.each(['select', 'period', 'owner', 'permission', 'refresh'])('clears the old result/files on %s scope change', async reason => {
  const view = render(panel()), select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } }); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли відбору' })
  if (reason === 'select') fireEvent.change(select, { target: { value: '' } })
  if (reason === 'period') fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-Q4' } })
  if (reason === 'owner') view.rerender(panel('receipts', 'owner-b'))
  if (reason === 'permission') view.rerender(panel('receipts', 'owner-a', false))
  if (reason === 'refresh') fireEvent.click(screen.getByRole('button', { name: 'Оновити статті' }))
  expect(screen.queryByRole('region', { name: 'Результат руху коштів' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли відбору' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull(); expect(previewCashMovement).toHaveBeenCalledOnce()
})
it('clears a stale409 selection, reloads genuine choices and requires manual preview', async () => {
  vi.mocked(previewCashMovement).mockRejectedValueOnce(new ApiError('cash_article_changed', 409, null))
  render(panel()); const select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } }); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(getCashMovementArticleChoices).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('combobox', { name: 'Стаття руху коштів' }) as HTMLSelectElement).value).toBe('')
  expect(previewCashMovement).toHaveBeenCalledOnce(); expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Стаття руху коштів' }), { target: { value: CASH_MOVEMENT_TEST_ARTICLE } })
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByRole('region', { name: 'Результат руху коштів' })
  expect(previewCashMovement).toHaveBeenCalledTimes(2)
})
it('uses manual empty-page pagination and retains duplicate names without a guessed selection', async () => {
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce({ ...cashMovementArticleChoices(), Choices: [], ContinuationKey: 'next' })
    .mockResolvedValueOnce({ ...cashMovementArticleChoices(), Choices: [cashMovementArticleChoices().Choices[0], { Key: 'second', Caption: cashMovementArticleChoices().Choices[0].Caption }] })
  render(panel()); await screen.findByText('На цій сторінці немає доступних назв статей. Перегляньте наступну сторінку.')
  expect(getCashMovementArticleChoices).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Ще статті' }))
  const select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  expect(within(select).getAllByRole('option')).toHaveLength(3); expect((select as HTMLSelectElement).value).toBe('')
  expect(vi.mocked(getCashMovementArticleChoices).mock.calls[1][4]).toBe('next')
})
it('refuses a substituted selected caption before inline values or file links appear', async () => {
  const report = cashMovementFilteredReport(); report.ArticleFilter!.Caption = 'Інша стаття'
  vi.mocked(previewCashMovement).mockResolvedValueOnce(report)
  render(panel()); const select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } }); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Відбір звіту змінився. Оновіть список статей.')
  expect(screen.queryByRole('region', { name: 'Результат руху коштів' })).toBeNull(); expect(screen.queryByRole('dialog', { name: 'Файли відбору' })).toBeNull()
})
it('aborts a pending selected preview on owner change and ignores late files', async () => {
  let finish!: (report: ReturnType<typeof cashMovementFilteredReport>) => void
  vi.mocked(previewCashMovement).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()), select = await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(select, { target: { value: CASH_MOVEMENT_TEST_ARTICLE } }); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewCashMovement).mock.calls[0][3]
  view.rerender(panel('receipts', 'owner-b')); expect(oldSignal.aborted).toBe(true)
  await act(async () => { finish(cashMovementFilteredReport()) })
  expect(screen.queryByRole('region', { name: 'Результат руху коштів' })).toBeNull(); expect(screen.queryByRole('dialog', { name: 'Файли відбору' })).toBeNull()
})
it('blocks dirty dates and disabled access without adding a raw reference or currency field', async () => {
  const view = render(panel()); await screen.findByRole('combobox', { name: 'Стаття руху коштів' })
  fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-09' } })
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByLabelText('Валюта')).toBeNull(); expect(screen.queryByLabelText('RRef')).toBeNull()
  view.rerender(panel('receipts', 'owner-a', false)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewCashMovement).not.toHaveBeenCalled()
})
