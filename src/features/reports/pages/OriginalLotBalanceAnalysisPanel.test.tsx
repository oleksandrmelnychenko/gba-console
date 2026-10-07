import { lotAnalysisXlsx } from '../data/originalLotBalanceAnalysisExport'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readLotAnalysis } from '../api/originalLotBalanceAnalysisApi'
import { lotAnalysisCapability, lotAnalysisResponse, missingLotAnalysis, emptyLotAnalysis, lotProduct, lotWarehouse } from '../testing/originalLotBalanceAnalysisFixtures'
import { normalizeLotAnalysis, type LotAnalysisResult } from '../data/originalLotBalanceAnalysis'
import { OriginalLotBalanceAnalysisPanel } from './OriginalLotBalanceAnalysisPanel'
vi.mock('../api/originalLotBalanceAnalysisApi', () => ({ readLotAnalysis: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalLotBalanceAnalysisPanel capability={lotAnalysisCapability}
  callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
it('shows warehouse→product with four signed cells and enables every export from one completed result', async () => {
  vi.clearAllMocks(); vi.mocked(readLotAnalysis).mockResolvedValue(lotAnalysisResponse()); render(panel())
  expect(screen.queryByRole('combobox', { name: 'Покупці' })).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const table = await screen.findByRole('table'), row = within(table).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Наш склад', 'Наш товар', '-5.000', '-12.00', '-4.000', '-10.00'])
  expect(readLotAnalysis).toHaveBeenCalledTimes(1)
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('missing normal parents never show a table or enable any export', async () => {
  vi.clearAllMocks(); vi.mocked(readLotAnalysis).mockResolvedValue(missingLotAnalysis()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Для звіту потрібні повні початкові залишки/); expect(screen.queryByRole('table')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller replacement aborts the first request and rejects late rows and files', async () => {
  vi.clearAllMocks(); let complete!: (r: LotAnalysisResult) => void
  vi.mocked(readLotAnalysis).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readLotAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readLotAnalysis).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { complete(lotAnalysisResponse()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('both selected human filters stay clearable after complete empty choice populations', async () => {
  vi.clearAllMocks(); vi.mocked(readLotAnalysis).mockResolvedValue(lotAnalysisResponse()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, label] of [['Склади', 'Наш склад'], ['Товари', 'Наш товар']]) {
    fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name: label }))
  }
  expect(screen.queryByRole('table')).toBeNull()
  vi.mocked(readLotAnalysis).mockImplementation(async request => normalizeLotAnalysis({ ...emptyLotAnalysis(), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readLotAnalysis).mock.calls[1][0]).toMatchObject({ Warehouses: [lotWarehouse], Products: [lotProduct], Buyers: [] })
  for (const field of ['Склади', 'Товари']) { const input = screen.getByRole('combobox', { name: field }) as HTMLInputElement
    expect(input.disabled).toBe(false); fireEvent.keyDown(input, { key: 'Backspace' }) }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readLotAnalysis).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readLotAnalysis).mock.calls[2][0]).toMatchObject({ Warehouses: [], Products: [] })
})
it('permission denial prevents generation', () => {
  vi.clearAllMocks(); render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readLotAnalysis).not.toHaveBeenCalled()
})

vi.mock('../data/originalLotBalanceAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalLotBalanceAnalysisExport')>()
  return { ...actual, lotAnalysisXlsx: vi.fn() }
})
it('a deferred XLSX cannot revive after permission loss and return to the same caller scope', async () => {
  vi.clearAllMocks(); let finish!: (blob: Blob) => void
  vi.mocked(lotAnalysisXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  vi.mocked(readLotAnalysis).mockResolvedValue(lotAnalysisResponse())
  const prior = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:late-export')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); await waitFor(() => expect(lotAnalysisXlsx).toHaveBeenCalledTimes(1))
    view.rerender(panel('caller1', false)); view.rerender(panel('caller1', true))
    await act(async () => { finish(new Blob(['stale file'])) })
    expect(create).not.toHaveBeenCalled()
  } finally {
    if (prior) Object.defineProperty(URL, 'createObjectURL', prior)
    else Reflect.deleteProperty(URL, 'createObjectURL')
  }
})
