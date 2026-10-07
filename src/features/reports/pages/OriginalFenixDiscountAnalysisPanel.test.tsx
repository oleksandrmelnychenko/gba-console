import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readFenixDiscountAnalysis } from '../api/originalFenixDiscountAnalysisApi'
import { fenixDiscountXlsx } from '../data/originalFenixDiscountAnalysisExport'
import type { FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
import { fenixCapability, fenixEmpty, fenixMissing, fenixProduct, fenixResult, fenixScope, fenixUnresolved } from '../testing/originalFenixDiscountAnalysisFixtures'
import { OriginalFenixDiscountAnalysisPanel } from './OriginalFenixDiscountAnalysisPanel'
vi.mock('../api/originalFenixDiscountAnalysisApi', () => ({ readFenixDiscountAnalysis: vi.fn() }))
vi.mock('../data/originalFenixDiscountAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalFenixDiscountAnalysisExport')>(); return { ...actual, fenixDiscountXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalFenixDiscountAnalysisPanel
  capability={fenixCapability} callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
it('renders own default matrix and sends empty filters while genuine named controls remain unavailable', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountAnalysis).mockResolvedValue(fenixResult()); render(panel())
  for (const name of ['Контрагенти', 'Номенклатура']) expect((screen.getByRole('combobox', { name }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader').map(v => v.textContent)).toEqual(['Контрагент', 'Товар Fenix · Тип ціни', 'Товар Fenix · Відсоток знижки/націнки'])
  expect(within(table).getAllByRole('cell').map(v => v.textContent)).toEqual(['Клієнт Fenix', 'Роздрібна', '-12.340'])
  expect(screen.queryByText('Разом')).toBeNull(); expect(screen.queryByText(fenixProduct)).toBeNull()
  expect(vi.mocked(readFenixDiscountAnalysis).mock.calls[0][0]).toEqual(fenixScope()); for (const format of ['CSV', 'XLSX', 'PDF']) expect(button(format).disabled).toBe(false)
})
it('distinguishes missing publications, unresolved resources and complete empty results', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountAnalysis).mockResolvedValueOnce(fenixMissing()).mockResolvedValueOnce(fenixUnresolved()).mockResolvedValueOnce(fenixEmpty())
  render(panel()); fireEvent.click(button('Сформувати')); await screen.findByText(/Повні узгоджені звичайні дані/)
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText(/Частина назв або ресурсів/); expect(await screen.findByText('Недоступно')).toBeTruthy(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(button('CSV').disabled).toBe(false)
})
it('permission denial prevents I/O and permission ABA cancels the original preview', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountResult) => void; vi.mocked(readFenixDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel(false)); fireEvent.click(button('Сформувати')); expect(readFenixDiscountAnalysis).not.toHaveBeenCalled()
  view.rerender(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountAnalysis).mock.calls[0][1]; view.rerender(panel(false)); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('date replacement clears the completed result and rejects invalid dates before dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountAnalysis).mockResolvedValue(fenixResult()); render(panel()); fireEvent.click(button('Сформувати')); await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '' } }); fireEvent.click(button('Сформувати')); expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(1)
})
it('navigation unmount aborts the original preview and does not retain late results', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountResult) => void; vi.mocked(readFenixDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountAnalysis).mock.calls[0][1]; view.unmount(); expect(signal?.aborted).toBe(true); await act(async () => { finish(fenixResult()) })
  render(panel()); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('caller ABA rejects a late original preview even when the exact caller key returns', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountResult) => void; vi.mocked(readFenixDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountAnalysis).mock.calls[0][1]; view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('deferred XLSX never downloads after caller replacement and return to the original caller', async () => {
  vi.clearAllMocks(); let finish!: (v: Blob) => void; vi.mocked(fenixDiscountXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readFenixDiscountAnalysis).mockResolvedValue(fenixResult())
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(fenixDiscountXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['stale'])) }); expect(create).not.toHaveBeenCalled()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
it('pages product columns only for display while the completed full matrix remains exportable', async () => {
  vi.clearAllMocks(); const result = fenixResult(); result.Cells = Array.from({ length: 11 }, (_, i) => ({ ...structuredClone(result.Cells[0]),
    ProductRef: (i + 1).toString(16).toUpperCase().padStart(32, '0'), ProductCaption: `Товар ${i + 1}` }))
  vi.mocked(readFenixDiscountAnalysis).mockResolvedValue(result); render(panel()); fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader')).toHaveLength(21); fireEvent.click(button('Наступна номенклатура'))
  expect(within(table).getAllByRole('columnheader')).toHaveLength(3); expect(screen.getByText('Товар 11 · Тип ціни')).toBeTruthy(); expect(button('CSV').disabled).toBe(false)
})
