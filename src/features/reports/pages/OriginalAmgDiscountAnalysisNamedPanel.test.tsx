import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysis, readAmgDiscountAnalysisChoices } from '../api/originalAmgDiscountAnalysisApi'
import type { AmgDiscountAnalysisChoices } from '../data/originalAmgDiscountAnalysisChoices'
import { normalizeAmgDiscountAnalysisResult } from '../data/originalAmgDiscountAnalysis'
import { amgDiscountAnalysisXlsx } from '../data/originalAmgDiscountAnalysisExport'
import { amgChoiceWitness, amgNames, amgReadiness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { amgCapability, amgParty, amgProduct, amgResult } from '../testing/originalAmgDiscountAnalysisFixtures'
import { OriginalAmgDiscountAnalysisPanel } from './OriginalAmgDiscountAnalysisPanel'
vi.mock('../api/originalAmgDiscountAnalysisApi', () => ({ readAmgDiscountAnalysis: vi.fn(), readAmgDiscountAnalysisChoices: vi.fn(), getAmgDiscountAnalysisReadiness: vi.fn() }))
vi.mock('../data/originalAmgDiscountAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalAmgDiscountAnalysisExport')>(); return { ...actual, amgDiscountAnalysisXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalAmgDiscountAnalysisPanel
  capability={amgCapability} callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const selector = (name: string) => screen.getByRole('combobox', { name }) as HTMLInputElement
function namesSetup(names = amgNames()) {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountAnalysisChoices).mockResolvedValue(names); vi.mocked(getAmgDiscountAnalysisReadiness).mockResolvedValue(amgReadiness())
  vi.mocked(readAmgDiscountAnalysis).mockImplementation(async request => {
    const result = amgResult(request), party = names.Choices.Контрагент.find(c => c.Reference === request.Counterparties[0])
    if (party) Object.assign(result.Cells[0], { CounterpartyRef: party.Reference, CounterpartyCaption: party.Caption })
    return normalizeAmgDiscountAnalysisResult(result, request)
  })
}
async function load() { fireEvent.click(button('Оновити назви')); await waitFor(() => expect(selector('Контрагенти').disabled).toBe(false)) }
it('enables authentic searchable named selectors and sends the selected current witness without exposing raw labels', async () => {
  namesSetup(); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт AMG' }))
  fireEvent.click(selector('Номенклатура')); fireEvent.click(await screen.findByRole('option', { name: 'Товар AMG' }))
  expect(screen.queryByText(amgParty)).toBeNull(); fireEvent.click(button('Сформувати')); await screen.findByRole('table')
  const request = vi.mocked(readAmgDiscountAnalysis).mock.calls[0][0]
  expect(request.Counterparties).toEqual([amgParty]); expect(request.Products).toEqual([amgProduct]); expect(request.ChoicesWitnessSha256).toBe(amgChoiceWitness)
  expect(button('CSV').disabled).toBe(false)
})
it('keeps genuine counterparties enabled independently when product names remain unavailable', async () => {
  const names = amgNames(); names.FieldAvailability.Номенклатура = false; names.Choices.Номенклатура = []; names.MissingFamilies = ['Номенклатура']; names.HumanChoicesAvailable = false
  namesSetup(names); render(panel()); await load(); expect(selector('Номенклатура').disabled).toBe(true)
  expect(screen.getByText(/Назви ще недоступні.*Номенклатура/)).toBeTruthy(); expect(selector('Контрагенти').disabled).toBe(false)
})
it('limits rendered names while a name outside the first hundred remains searchable and selectable', async () => {
  const names = amgNames(); names.Choices.Контрагент = Array.from({ length: 150 }, (_, i) => ({ ...names.Choices.Контрагент[0], Reference: (i + 1).toString(16).toUpperCase().padStart(32, '0'), Caption: `Клієнт ${String(i).padStart(3, '0')}` }))
  namesSetup(names); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(100)
  fireEvent.change(selector('Контрагенти'), { target: { value: 'Клієнт 149' } }); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт 149' }))
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1))
  expect(vi.mocked(readAmgDiscountAnalysis).mock.calls[0][0].Counterparties).toEqual(['00000000000000000000000000000096'])
})
it('rejects a late names response across caller ABA and allows only a fresh owned load', async () => {
  namesSetup(); let finish!: (v: AmgDiscountAnalysisChoices) => void
  vi.mocked(readAmgDiscountAnalysisChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(readAmgDiscountAnalysisChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysisChoices).mock.calls[0][1]; view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgNames()) }); expect(selector('Контрагенти').disabled).toBe(true)
  await load(); expect(readAmgDiscountAnalysisChoices).toHaveBeenCalledTimes(2)
})
it('permission denial opens no names client and permission replacement aborts both owned readers', async () => {
  namesSetup(); vi.mocked(readAmgDiscountAnalysisChoices).mockImplementation(() => new Promise(() => {})); vi.mocked(getAmgDiscountAnalysisReadiness).mockImplementation(() => new Promise(() => {}))
  const view = render(panel(false)); fireEvent.click(button('Оновити назви')); expect(readAmgDiscountAnalysisChoices).not.toHaveBeenCalled(); expect(getAmgDiscountAnalysisReadiness).not.toHaveBeenCalled()
  view.rerender(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(getAmgDiscountAnalysisReadiness).toHaveBeenCalledTimes(1))
  view.rerender(panel(false)); expect(vi.mocked(readAmgDiscountAnalysisChoices).mock.calls[0][1]?.aborted).toBe(true); expect(vi.mocked(getAmgDiscountAnalysisReadiness).mock.calls[0][0]?.aborted).toBe(true)
})
it('date replacement clears offered choices, selected filters and completed exports', async () => {
  namesSetup(); render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт AMG' }))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } })
  expect(selector('Контрагенти').disabled).toBe(true); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1); expect(button('Сформувати').disabled).toBe(true)
  const changed = amgNames(); changed.Through = '2026-10-01'; vi.mocked(readAmgDiscountAnalysisChoices).mockResolvedValue(changed); await load()
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(2))
  const current = vi.mocked(readAmgDiscountAnalysis).mock.calls[1][0]; expect(current.Counterparties).toEqual([]); expect(current.ChoicesWitnessSha256).toBe(changed.ChoicesWitnessSha256); expect(current.Through).toBe('2026-10-01')
})
it('caller replacement cancels an in-flight named export before a fresh names load can authorize another result', async () => {
  namesSetup(); let finish!: (v: Blob) => void; vi.mocked(amgDiscountAnalysisXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:old'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); await load(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(amgDiscountAnalysisXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['old'])) }); expect(create).not.toHaveBeenCalled(); expect(screen.queryByRole('table')).toBeNull(); await load()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
it('refreshing a rotated names witness clears selected keys and the old completed result before another preview', async () => {
  namesSetup(); const rotated = amgNames(); rotated.ChoicesWitnessSha256 = 'e'.repeat(64); rotated.ResultSha256 = 'f'.repeat(64)
  vi.mocked(readAmgDiscountAnalysisChoices).mockResolvedValueOnce(amgNames()).mockResolvedValueOnce(rotated)
  render(panel()); await load(); fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт AMG' }))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); await load()
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(2))
  const current = vi.mocked(readAmgDiscountAnalysis).mock.calls[1][0]; expect(current.Counterparties).toEqual([]); expect(current.ChoicesWitnessSha256).toBe(rotated.ChoicesWitnessSha256)
})
it('navigation unmount aborts original choices and readiness together without keeping late names', async () => {
  namesSetup(); let finish!: (v: AmgDiscountAnalysisChoices) => void; vi.mocked(readAmgDiscountAnalysisChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(readAmgDiscountAnalysisChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysisChoices).mock.calls[0][1]; view.unmount(); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgNames()) }); render(panel()); expect(selector('Контрагенти').disabled).toBe(true)
})

it('requires actual OUR readiness before any preview despite a implemented static capability and available names', async () => {
  namesSetup(); vi.mocked(getAmgDiscountAnalysisReadiness).mockResolvedValue({ ...amgReadiness(), OrdinaryPublicationAvailable: false, OurSnapshotVerified: false,
    Executable: false, NormalInputsReadinessVerified: false, InputWitnessSha256: null, Dependency: 'ordinary_amg_discount_family_missing:register' })
  render(panel()); expect(button('Сформувати').disabled).toBe(true); await load(); fireEvent.click(button('Сформувати'))
  expect(readAmgDiscountAnalysis).not.toHaveBeenCalled(); expect(selector('Контрагенти').disabled).toBe(false); expect(button('Сформувати').disabled).toBe(true)
})
it('allows viewing an independent family while incomplete agreement or characteristic coverage blocks its selected preview', async () => {
  const names = amgNames(); names.OrdinaryPublicationAvailable = false; names.ReferenceCoverageVerified = false; names.HumanChoicesAvailable = false
  names.Dependency = 'ordinary_amg_discount_reference_coverage_unavailable'; namesSetup(names); render(panel()); await load()
  fireEvent.click(selector('Контрагенти')); fireEvent.click(await screen.findByRole('option', { name: 'Клієнт AMG' })); fireEvent.click(button('Сформувати'))
  expect(readAmgDiscountAnalysis).not.toHaveBeenCalled(); expect(button('Сформувати').disabled).toBe(true)
})
it('fresh names after caller replacement cannot adopt the earlier preview despite equal dates and references', async () => {
  namesSetup(); let finish!: (v: ReturnType<typeof amgResult>) => void
  vi.mocked(readAmgDiscountAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await load(); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscountAnalysis).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountAnalysis).mock.calls[0][1]
  view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await load(); await act(async () => { finish(amgResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
