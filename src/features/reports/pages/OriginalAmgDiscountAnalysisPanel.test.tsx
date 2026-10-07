import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysis, readAmgDiscountAnalysisChoices } from '../api/originalAmgDiscountAnalysisApi'
import { amgDiscountAnalysisXlsx } from '../data/originalAmgDiscountAnalysisExport'
import type { AmgDiscountAnalysisResult } from '../data/originalAmgDiscountAnalysis'
import { amgCapability, amgEmpty, amgMissing, amgProduct, amgResult, amgScope, amgUnresolved } from '../testing/originalAmgDiscountAnalysisFixtures'
import { amgNames, amgReadiness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { OriginalAmgDiscountAnalysisPanel } from './OriginalAmgDiscountAnalysisPanel'
vi.mock('../api/originalAmgDiscountAnalysisApi', () => ({ readAmgDiscountAnalysis: vi.fn(), readAmgDiscountAnalysisChoices: vi.fn(), getAmgDiscountAnalysisReadiness: vi.fn() }))
vi.mock('../data/originalAmgDiscountAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalAmgDiscountAnalysisExport')>(); return { ...actual, amgDiscountAnalysisXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalAmgDiscountAnalysisPanel
  capability={amgCapability} callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
async function ready() {
  const names = amgNames(); Object.assign(names, { OrdinaryPublicationAvailable: false, OurSnapshotVerified: false, ReferenceCoverageVerified: false, HumanChoicesAvailable: false,
    InputWitnessSha256: null, ChoicesWitnessSha256: null, FieldAvailability: { Контрагент: false, Номенклатура: false }, Choices: { Контрагент: [], Номенклатура: [] },
    MissingFamilies: ['Контрагент', 'Номенклатура'], Dependency: 'ordinary_amg_discount_named_family_unavailable' })
  vi.mocked(readAmgDiscountAnalysisChoices).mockResolvedValue(names); vi.mocked(getAmgDiscountAnalysisReadiness).mockResolvedValue(amgReadiness())
  fireEvent.click(button('Оновити назви')); await waitFor(() => expect(button('Сформувати').disabled).toBe(false))
}
it('renders own default matrix and sends empty filters while both own named controls remain unavailable', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountAnalysis).mockResolvedValue(amgResult()); render(panel())
  for (const name of ['Контрагенти', 'Номенклатура']) expect((screen.getByRole('combobox', { name }) as HTMLInputElement).disabled).toBe(true)
  await ready(); fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader').map(v => v.textContent)).toEqual(['Контрагент', 'Товар AMG · Тип ціни', 'Товар AMG · Відсоток знижки/націнки'])
  expect(within(table).getAllByRole('cell').map(v => v.textContent)).toEqual(['Клієнт AMG', 'Роздрібна', '-12.340'])
  expect(screen.queryByText('Разом')).toBeNull(); expect(screen.queryByText(amgProduct)).toBeNull()
  expect(vi.mocked(readAmgDiscountAnalysis).mock.calls[0][0]).toEqual(amgScope()); for (const format of ['CSV', 'XLSX', 'PDF']) expect(button(format).disabled).toBe(false)
})
it('distinguishes missing publications, unresolved resources and complete empty results', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountAnalysis).mockResolvedValueOnce(amgMissing()).mockResolvedValueOnce(amgUnresolved()).mockResolvedValueOnce(amgEmpty())
  render(panel()); await ready(); fireEvent.click(button('Сформувати')); await screen.findByText(/Повні узгоджені звичайні дані AMG/)
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText(/Частина назв або ресурсів AMG/); expect(await screen.findByText('Недоступно')).toBeTruthy(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(button('CSV').disabled).toBe(false)
})
it('permission denial prevents I/O and permission ABA cancels the original preview', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountAnalysisResult) => void; vi.mocked(readAmgDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel(false)); fireEvent.click(button('Сформувати')); expect(readAmgDiscountAnalysis).not.toHaveBeenCalled()
  view.rerender(panel()); await ready(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysis).mock.calls[0][1]; view.rerender(panel(false)); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('date replacement clears the completed result and rejects invalid dates before dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountAnalysis).mockResolvedValue(amgResult()); render(panel()); await ready(); fireEvent.click(button('Сформувати')); await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '' } }); fireEvent.click(button('Сформувати')); expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1)
})
it('navigation unmount aborts the original preview and does not retain late results', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountAnalysisResult) => void; vi.mocked(readAmgDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await ready(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysis).mock.calls[0][1]; view.unmount(); expect(signal?.aborted).toBe(true); await act(async () => { finish(amgResult()) })
  render(panel()); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('caller ABA rejects a late original preview even when the exact caller key returns', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountAnalysisResult) => void; vi.mocked(readAmgDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await ready(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysis).mock.calls[0][1]; view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('deferred XLSX never downloads after caller replacement and return to the original caller', async () => {
  vi.clearAllMocks(); let finish!: (v: Blob) => void; vi.mocked(amgDiscountAnalysisXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readAmgDiscountAnalysis).mockResolvedValue(amgResult())
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); await ready(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(amgDiscountAnalysisXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['stale'])) }); expect(create).not.toHaveBeenCalled()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
it('pages product columns only for display while the completed full matrix remains exportable', async () => {
  vi.clearAllMocks(); const result = amgResult(); result.Cells = Array.from({ length: 11 }, (_, i) => ({ ...structuredClone(result.Cells[0]),
    ProductRef: (i + 1).toString(16).toUpperCase().padStart(32, '0'), ProductCaption: `Товар ${i + 1}` }))
  vi.mocked(readAmgDiscountAnalysis).mockResolvedValue(result); render(panel()); await ready(); fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader')).toHaveLength(21); fireEvent.click(button('Наступна номенклатура'))
  expect(within(table).getAllByRole('columnheader')).toHaveLength(3); expect(screen.getByText('Товар 11 · Тип ціни')).toBeTruthy(); expect(button('CSV').disabled).toBe(false)
})
