import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readDefectCost } from '../api/originalDefectCostApi'
import { defectCostXlsx } from '../data/originalDefectCostExport'
import type { DefectCostResult } from '../data/originalDefectCost'
import { defectCostCapability, defectCostResponse, defectDivision, defectArticle, emptyDefectCost, missingDefectCost } from '../testing/originalDefectCostFixtures'
import { OriginalDefectCostPanel } from './OriginalDefectCostPanel'
vi.mock('../api/originalDefectCostApi', () => ({ readDefectCost: vi.fn() }))
vi.mock('../data/originalDefectCostExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalDefectCostExport')>()
  return { ...actual, defectCostXlsx: vi.fn() }
})
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalDefectCostPanel capability={defectCostCapability}
  callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
it('shows exact four signed cost cells by division then article with no raw references as captions', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCost).mockResolvedValue(defectCostResponse()); render(panel())
  expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Статті витрат' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table')
  const row = within(table).getByRole('cell', { name: 'Стаття витрат 1 · назва недоступна' }).closest('tr')
  if (!row) throw new Error('Article row is required')
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Підрозділ 1 · назва недоступна', 'Стаття витрат 1 · назва недоступна', '-10.00', '30.00', '-4.00', '24.00'])
  expect(screen.queryByText(defectDivision)).toBeNull(); expect(screen.queryByText(defectArticle)).toBeNull()
  expect(vi.mocked(readDefectCost).mock.calls[0][0]).toMatchObject({ Divisions: [], CostArticles: [], Measures: ['НачОст', 'Приход', 'Расход', 'КонОст'] })
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('a missing complete month displays its dependency and never fabricates rows zero totals or exports', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCost).mockResolvedValue(missingDefectCost()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Не всі місячні рухи цього періоду/); expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByText('0.00')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('complete empty is explicitly empty with genuine zero totals and keeps complete exports available', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCost).mockResolvedValue(emptyDefectCost()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(screen.getAllByText('0.00')).toHaveLength(4)
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('choosing optional VAT invalidates the old result and sends only the actual canonical selected resources', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCost).mockImplementation(async request => defectCostResponse(request.Measures)); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('combobox', { name: 'Показники' })); fireEvent.click(await screen.findByRole('option', { name: 'Початковий залишок · ПДВ' }))
  expect(screen.queryByRole('table')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readDefectCost).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readDefectCost).mock.calls[1][0].Measures).toEqual(['НачОст', 'НачОстНДС', 'Приход', 'Расход', 'КонОст'])
  expect(await screen.findByRole('columnheader', { name: 'Початковий залишок · ПДВ' })).toBeTruthy()
})
it('caller replacement aborts the original request and late normal data cannot restore financial rows', async () => {
  vi.clearAllMocks(); let finish!: (result: DefectCostResult) => void
  vi.mocked(readDefectCost).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readDefectCost).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readDefectCost).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(defectCostResponse()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('permission denial and an absent caller prevent request dispatch', () => {
  vi.clearAllMocks(); const view = render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readDefectCost).not.toHaveBeenCalled()
  view.rerender(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readDefectCost).not.toHaveBeenCalled()
})
it('a deferred XLSX cannot revive after permission loss and return to the same caller scope', async () => {
  vi.clearAllMocks(); let finish!: (file: Blob) => void
  vi.mocked(defectCostXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readDefectCost).mockResolvedValue(defectCostResponse())
  const prior = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); await waitFor(() => expect(defectCostXlsx).toHaveBeenCalledTimes(1))
    view.rerender(panel('caller1', false)); view.rerender(panel('caller1', true)); await act(async () => { finish(new Blob(['stale'])) })
    expect(create).not.toHaveBeenCalled()
  } finally { if (prior) Object.defineProperty(URL, 'createObjectURL', prior); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
