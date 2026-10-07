import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readPurchases } from '../api/originalPurchasesApi'
import { purchasesXlsx } from '../data/originalPurchasesExport'
import { purchasesFilterLabels, purchasesFilters, type PurchasesResult } from '../data/originalPurchases'
import { emptyPurchases, missingPurchases, purchasesCapability, purchasesParty, purchasesProduct, purchasesResponse, purchasesStatus } from '../testing/originalPurchasesFixtures'
import { OriginalPurchasesPanel } from './OriginalPurchasesPanel'
vi.mock('../api/originalPurchasesApi', () => ({ readPurchases: vi.fn(), readPurchasesChoices: vi.fn() }))
vi.mock('../data/originalPurchasesExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalPurchasesExport')>()
  return { ...actual, purchasesXlsx: vi.fn() }
})
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalPurchasesPanel capability={purchasesCapability}
  callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
it('shows all five unavailable filters and generates the exact unfiltered four-resource default hierarchy', async () => {
  vi.clearAllMocks(); vi.mocked(readPurchases).mockResolvedValue(purchasesResponse()); render(panel())
  for (const field of purchasesFilters) expect((screen.getByRole('combobox', { name: purchasesFilterLabels[field] }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table')
  const row = within(table).getByRole('cell', { name: 'Номенклатура 1 · назва недоступна, базова одиниця недоступна' }).closest('tr')
  if (!row) throw new Error('Product row is required')
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Статус партії 1 · назва недоступна', 'Контрагент 1 · назва недоступна', 'Номенклатура 1 · назва недоступна, базова одиниця недоступна', '1.000', '61.73', '12.35', '1.563'])
  for (const key of [purchasesStatus, purchasesParty, purchasesProduct]) expect(screen.queryByText(key)).toBeNull()
  expect(vi.mocked(readPurchases).mock.calls[0][0]).toMatchObject({ Statuses: [], Counterparties: [], Products: [], Divisions: [], Projects: [], Measures: ['КоличествоБазовыхЕд', 'СтоимостьОборот', 'НДСОборот', 'ВесОборот'] })
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('missing full monthly input never becomes zero rows totals or completed files', async () => {
  vi.clearAllMocks(); vi.mocked(readPurchases).mockResolvedValue(missingPurchases()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Не всі місячні рухи цього періоду/); expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByText('0.000')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('complete empty retains authenticated zero totals and completed exports', async () => {
  vi.clearAllMocks(); vi.mocked(readPurchases).mockResolvedValue(emptyPurchases()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(screen.getAllByText('0.000')).toHaveLength(2); expect(screen.getAllByText('0.00')).toHaveLength(2)
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('selecting report-unit quantity invalidates prior rows and retains server-rounded report subtotals', async () => {
  vi.clearAllMocks(); vi.mocked(readPurchases).mockImplementation(async request => purchasesResponse(request.Measures)); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  const measures = screen.getByRole('combobox', { name: 'Показники' }); fireEvent.click(measures)
  fireEvent.click(await screen.findByRole('option', { name: 'Кількість у звітних одиницях' })); fireEvent.blur(measures)
  expect(screen.queryByRole('table')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readPurchases).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readPurchases).mock.calls[1][0].Measures).toEqual(['КоличествоЕдиницОтчетов', 'КоличествоБазовыхЕд', 'СтоимостьОборот', 'НДСОборот', 'ВесОборот'])
  expect(await screen.findByRole('columnheader', { name: 'Кількість у звітних одиницях' })).toBeTruthy()
  expect(screen.getAllByText('0.667').length).toBeGreaterThan(0)
})
it('caller replacement aborts the owned original request and rejects its late completed rows', async () => {
  vi.clearAllMocks(); let finish!: (result: PurchasesResult) => void
  vi.mocked(readPurchases).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPurchases).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readPurchases).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(purchasesResponse()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('permission denial and an absent caller prevent preview dispatch', () => {
  vi.clearAllMocks(); const view = render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readPurchases).not.toHaveBeenCalled()
  view.rerender(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readPurchases).not.toHaveBeenCalled()
})
it('deferred completed-result XLSX stays cancelled after permission loss and return to the same caller', async () => {
  vi.clearAllMocks(); let finish!: (file: Blob) => void
  vi.mocked(purchasesXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readPurchases).mockResolvedValue(purchasesResponse())
  const prior = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); await waitFor(() => expect(purchasesXlsx).toHaveBeenCalledTimes(1))
    view.rerender(panel('caller1', false)); view.rerender(panel('caller1', true)); await act(async () => { finish(new Blob(['stale'])) })
    expect(create).not.toHaveBeenCalled()
  } finally { if (prior) Object.defineProperty(URL, 'createObjectURL', prior); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
