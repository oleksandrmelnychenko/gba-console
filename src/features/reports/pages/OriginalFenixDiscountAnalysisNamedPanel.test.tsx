import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getFenixDiscountReadiness, readFenixDiscountAnalysis, readFenixDiscountChoices } from '../api/originalFenixDiscountAnalysisApi'
import type { FenixDiscountChoices } from '../data/originalFenixDiscountAnalysisChoices'
import { normalizeFenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
import { fenixDiscountXlsx } from '../data/originalFenixDiscountAnalysisExport'
import { fenixChoiceWitness, fenixNames, fenixReadiness } from '../testing/originalFenixDiscountAnalysisChoicesFixtures'
import { fenixCapability, fenixParty, fenixProduct, fenixResult } from '../testing/originalFenixDiscountAnalysisFixtures'
import { OriginalFenixDiscountAnalysisPanel } from './OriginalFenixDiscountAnalysisPanel'
vi.mock('../api/originalFenixDiscountAnalysisApi', () => ({ readFenixDiscountAnalysis: vi.fn(), readFenixDiscountChoices: vi.fn(), getFenixDiscountReadiness: vi.fn() }))
vi.mock('../data/originalFenixDiscountAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalFenixDiscountAnalysisExport')>(); return { ...actual, fenixDiscountXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalFenixDiscountAnalysisPanel
  capability={fenixCapability} callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const selector = (name: string) => screen.getByRole('combobox', { name }) as HTMLInputElement
function namesSetup(names = fenixNames()) {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountChoices).mockResolvedValue(names); vi.mocked(getFenixDiscountReadiness).mockResolvedValue(fenixReadiness())
  vi.mocked(readFenixDiscountAnalysis).mockImplementation(async request => {
    const result = fenixResult(request), party = names.Choices.Контрагент.find(c => c.Reference === request.Counterparties[0])
    if (party) Object.assign(result.Cells[0], { CounterpartyRef: party.Reference, CounterpartyCaption: party.Caption })
    return normalizeFenixDiscountResult(result, request)
  })
}
async function load() { fireEvent.click(button('Оновити назви')); await waitFor(() => expect(selector('Контрагенти').disabled).toBe(false)) }
it('enables authentic searchable named selectors and sends the selected current witness without exposing raw labels', async () => {
  namesSetup(); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт Fenix' }))
  fireEvent.click(selector('Номенклатура')); fireEvent.click(await screen.findByRole('option', { name: 'Товар Fenix' }))
  expect(screen.queryByText(fenixParty)).toBeNull(); fireEvent.click(button('Сформувати')); await screen.findByRole('table')
  const request = vi.mocked(readFenixDiscountAnalysis).mock.calls[0][0]
  expect(request.Counterparties).toEqual([fenixParty]); expect(request.Products).toEqual([fenixProduct]); expect(request.ChoicesWitnessSha256).toBe(fenixChoiceWitness)
  expect(button('CSV').disabled).toBe(false)
})
it('keeps genuine counterparties enabled independently when product names remain unavailable', async () => {
  const names = fenixNames(); names.FieldAvailability.Номенклатура = false; names.Choices.Номенклатура = []; names.MissingFamilies = ['Номенклатура']; names.HumanChoicesAvailable = false
  namesSetup(names); render(panel()); await load(); expect(selector('Номенклатура').disabled).toBe(true)
  expect(screen.getByText(/Назви ще недоступні.*Номенклатура/)).toBeTruthy(); expect(selector('Контрагенти').disabled).toBe(false)
})
it('limits rendered names while a name outside the first hundred remains searchable and selectable', async () => {
  const names = fenixNames(); names.Choices.Контрагент = Array.from({ length: 150 }, (_, i) => ({ ...names.Choices.Контрагент[0], Reference: (i + 1).toString(16).toUpperCase().padStart(32, '0'), Caption: `Клієнт ${String(i).padStart(3, '0')}` }))
  namesSetup(names); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(100)
  fireEvent.change(selector('Контрагенти'), { target: { value: 'Клієнт 149' } }); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт 149' }))
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(1))
  expect(vi.mocked(readFenixDiscountAnalysis).mock.calls[0][0].Counterparties).toEqual(['00000000000000000000000000000096'])
})
it('rejects a late names response across caller ABA and allows only a fresh owned load', async () => {
  namesSetup(); let finish!: (v: FenixDiscountChoices) => void
  vi.mocked(readFenixDiscountChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(readFenixDiscountChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountChoices).mock.calls[0][1]; view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixNames()) }); expect(selector('Контрагенти').disabled).toBe(true)
  await load(); expect(readFenixDiscountChoices).toHaveBeenCalledTimes(2)
})
it('permission denial opens no names client and permission replacement aborts both owned readers', async () => {
  namesSetup(); vi.mocked(readFenixDiscountChoices).mockImplementation(() => new Promise(() => {})); vi.mocked(getFenixDiscountReadiness).mockImplementation(() => new Promise(() => {}))
  const view = render(panel(false)); fireEvent.click(button('Оновити назви')); expect(readFenixDiscountChoices).not.toHaveBeenCalled(); expect(getFenixDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(getFenixDiscountReadiness).toHaveBeenCalledTimes(1))
  view.rerender(panel(false)); expect(vi.mocked(readFenixDiscountChoices).mock.calls[0][1]?.aborted).toBe(true); expect(vi.mocked(getFenixDiscountReadiness).mock.calls[0][0]?.aborted).toBe(true)
})
it('date replacement clears offered choices, selected filters and completed exports', async () => {
  namesSetup(); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт Fenix' }))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } })
  expect(selector('Контрагенти').disabled).toBe(true); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(2))
  const current = vi.mocked(readFenixDiscountAnalysis).mock.calls[1][0]; expect(current.Counterparties).toEqual([]); expect(current.ChoicesWitnessSha256).toBeUndefined(); expect(current.Through).toBe('2026-10-01')
})
it('caller replacement cancels an in-flight named export before a fresh names load can authorize another result', async () => {
  namesSetup(); let finish!: (v: Blob) => void; vi.mocked(fenixDiscountXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:old'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); await load(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(fenixDiscountXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['old'])) }); expect(create).not.toHaveBeenCalled(); expect(screen.queryByRole('table')).toBeNull(); await load()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
it('refreshing a rotated names witness clears selected keys and the old completed result before another preview', async () => {
  namesSetup(); const rotated = fenixNames(); rotated.ChoicesWitnessSha256 = 'e'.repeat(64); rotated.ResultSha256 = 'f'.repeat(64)
  vi.mocked(readFenixDiscountChoices).mockResolvedValueOnce(fenixNames()).mockResolvedValueOnce(rotated)
  render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт Fenix' }))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); await load()
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscountAnalysis).toHaveBeenCalledTimes(2))
  const current = vi.mocked(readFenixDiscountAnalysis).mock.calls[1][0]; expect(current.Counterparties).toEqual([]); expect(current.ChoicesWitnessSha256).toBe(rotated.ChoicesWitnessSha256)
})
it('navigation unmount aborts original choices and readiness together without keeping late names', async () => {
  namesSetup(); let finish!: (v: FenixDiscountChoices) => void; vi.mocked(readFenixDiscountChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(readFenixDiscountChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountChoices).mock.calls[0][1]; view.unmount(); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixNames()) }); render(panel()); expect(selector('Контрагенти').disabled).toBe(true)
})
