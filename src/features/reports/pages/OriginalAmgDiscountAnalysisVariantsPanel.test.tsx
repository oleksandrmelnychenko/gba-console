import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysis, readAmgDiscountAnalysisChoices } from '../api/originalAmgDiscountAnalysisApi'
import { deleteAmgDiscountVariant, listAmgDiscountVariants, loadAmgDiscountVariant, saveAmgDiscountVariant } from '../api/originalAmgDiscountAnalysisVariantsApi'
import { amgNames, amgReadiness, amgChoiceWitness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { amgCapability, amgParty, amgProduct, amgResult } from '../testing/originalAmgDiscountAnalysisFixtures'
import { amgVariant, amgVariantList } from '../testing/originalAmgDiscountVariantFixtures'
import { OriginalAmgDiscountAnalysisPanel } from './OriginalAmgDiscountAnalysisPanel'
vi.mock('../api/originalAmgDiscountAnalysisApi', () => ({ readAmgDiscountAnalysis: vi.fn(), readAmgDiscountAnalysisChoices: vi.fn(), getAmgDiscountAnalysisReadiness: vi.fn() }))
vi.mock('../api/originalAmgDiscountAnalysisVariantsApi', () => ({ deleteAmgDiscountVariant: vi.fn(), listAmgDiscountVariants: vi.fn(), loadAmgDiscountVariant: vi.fn(), saveAmgDiscountVariant: vi.fn() }))
const panel = (caller = 'one', permitted = true) => <MantineProvider env="test"><I18nProvider><OriginalAmgDiscountAnalysisPanel capability={amgCapability} callerKey={caller} canGenerate={permitted} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
function setup() {
  vi.clearAllMocks(); vi.mocked(listAmgDiscountVariants).mockResolvedValue(amgVariantList()); vi.mocked(loadAmgDiscountVariant).mockResolvedValue(amgVariant())
  vi.mocked(getAmgDiscountAnalysisReadiness).mockResolvedValue(amgReadiness())
  vi.mocked(readAmgDiscountAnalysisChoices).mockImplementation(async request => ({ ...amgNames(), Through: request.Through, RequestedCounterparties: [...request.Counterparties], RequestedProducts: [...request.Products] }))
  vi.mocked(readAmgDiscountAnalysis).mockImplementation(async request => amgResult(request))
}
async function choose() {
  fireEvent.click(button('Оновити варіанти AMG')); await waitFor(() => expect((screen.getByRole('combobox', { name: 'Збережений варіант AMG' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Збережений варіант AMG' })); fireEvent.click(await screen.findByRole('option', { name: 'Мій AMG' }))
}
it('loads exact saved date and filters then refreshes own names before binding a new preview witness', async () => {
  setup(); const saved = amgVariant(); saved.Scope.Request.Through = '2026-10-01'; vi.mocked(loadAmgDiscountVariant).mockResolvedValue(saved)
  render(panel()); await choose(); fireEvent.click(button('Відкрити варіант AMG')); await waitFor(() => expect(button('Сформувати').disabled).toBe(false))
  expect((screen.getByLabelText('Дата зрізу') as HTMLInputElement).value).toBe('2026-10-01'); expect(readAmgDiscountAnalysisChoices).toHaveBeenCalledTimes(1)
  const namesRequest = vi.mocked(readAmgDiscountAnalysisChoices).mock.calls[0][0]; expect(namesRequest.Counterparties).toEqual([amgParty]); expect(namesRequest.Products).toEqual([amgProduct]); expect(namesRequest.ChoicesWitnessSha256).toBeUndefined()
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); expect(vi.mocked(readAmgDiscountAnalysis).mock.calls[0][0].ChoicesWitnessSha256).toBe(amgChoiceWitness)
  expect(button('CSV').disabled).toBe(false)
})
it('keeps unavailable saved refs intact and blocks generation until an explicit clear rather than silently broadening scope', async () => {
  setup(); const saved = amgVariant(); saved.Scope.Request.Products = ['9'.repeat(32)]; vi.mocked(loadAmgDiscountVariant).mockResolvedValue(saved)
  render(panel()); await choose(); fireEvent.click(button('Відкрити варіант AMG')); await screen.findByText(/Збережені відбори AMG ще не підтверджені/)
  await waitFor(() => expect(button('Очистити збережені відбори AMG').disabled).toBe(false)); fireEvent.click(button('Сформувати')); expect(readAmgDiscountAnalysis).not.toHaveBeenCalled()
  expect(screen.queryByText('9'.repeat(32))).toBeNull(); expect(saved.Scope.Request.Products).toEqual(['9'.repeat(32)])
  fireEvent.click(button('Очистити збережені відбори AMG')); fireEvent.click(button('Сформувати')); await screen.findByRole('table')
  expect(vi.mocked(readAmgDiscountAnalysis).mock.calls[0][0].Products).toEqual([])
})
it('caller ABA cancels a late saved revision without applying it or refreshing another owners names', async () => {
  setup(); let finish!: (value: ReturnType<typeof amgVariant>) => void; vi.mocked(loadAmgDiscountVariant).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await choose(); fireEvent.click(button('Відкрити варіант AMG')); await waitFor(() => expect(loadAmgDiscountVariant).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(loadAmgDiscountVariant).mock.calls[0][1]; view.rerender(panel('two')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgVariant()) }); expect(readAmgDiscountAnalysisChoices).not.toHaveBeenCalled(); expect(button('Сформувати').disabled).toBe(true)
})
it('missing own storage and permission denial never authorize variant mutations', async () => {
  setup(); const view = render(panel('one', false)); fireEvent.click(button('Оновити варіанти AMG')); expect(listAmgDiscountVariants).not.toHaveBeenCalled()
  vi.mocked(listAmgDiscountVariants).mockResolvedValue({ StorageAvailable: false, Dependency: 'original_amg_discount_variant_storage_unavailable', Items: [] }); view.rerender(panel())
  fireEvent.click(button('Оновити варіанти AMG')); await screen.findByText('Сховище власних варіантів AMG ще недоступне.'); fireEvent.change(screen.getByLabelText('Назва варіанта AMG'), { target: { value: 'mine' } })
  fireEvent.click(button('Зберегти як новий варіант AMG')); expect(saveAmgDiscountVariant).not.toHaveBeenCalled(); expect(deleteAmgDiscountVariant).not.toHaveBeenCalled()
})
it('updates and deletes only the loaded own revision while removing the current publication witness from storage', async () => {
  setup(); let stored: ReturnType<typeof amgVariant> | null = amgVariant()
  vi.mocked(listAmgDiscountVariants).mockImplementation(async () => ({ StorageAvailable: true, Dependency: null, Items: stored ? [stored] : [] }))
  vi.mocked(saveAmgDiscountVariant).mockImplementation(async request => { stored = { ...amgVariant(), Id: request.Id!, Revision: request.Revision + 1, Name: request.Name, Scope: request.Scope }; return stored })
  vi.mocked(deleteAmgDiscountVariant).mockImplementation(async () => { stored = null })
  render(panel()); await choose(); fireEvent.click(button('Відкрити варіант AMG')); await waitFor(() => expect(button('Сформувати').disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Назва варіанта AMG'), { target: { value: 'Оновлений AMG' } }); fireEvent.click(button('Оновити власний варіант AMG'))
  await waitFor(() => expect(button('Видалити власний варіант AMG').disabled).toBe(false))
  const saved = vi.mocked(saveAmgDiscountVariant).mock.calls[0][0]
  expect(saved.Id).toBe(amgVariant().Id); expect(saved.Revision).toBe(1); expect(saved.Scope.Request.Counterparties).toEqual([amgParty]); expect(saved.Scope.Request.Products).toEqual([amgProduct]); expect(saved.Scope.Request.ChoicesWitnessSha256).toBeUndefined()
  fireEvent.click(button('Видалити власний варіант AMG')); await waitFor(() => expect(deleteAmgDiscountVariant).toHaveBeenCalledTimes(1))
  expect(vi.mocked(deleteAmgDiscountVariant).mock.calls[0][0].Revision).toBe(2)
  await waitFor(() => expect(button('Відкрити варіант AMG').disabled).toBe(true))
})
it('a newer date cancels a pending saved revision and cannot be overwritten by its late response', async () => {
  setup(); let finish!: (value: ReturnType<typeof amgVariant>) => void
  vi.mocked(loadAmgDiscountVariant).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(panel()); await choose(); fireEvent.click(button('Відкрити варіант AMG')); await waitFor(() => expect(loadAmgDiscountVariant).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(loadAmgDiscountVariant).mock.calls[0][1]
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-02' } }); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgVariant()) })
  expect((screen.getByLabelText('Дата зрізу') as HTMLInputElement).value).toBe('2026-10-02'); expect(readAmgDiscountAnalysisChoices).not.toHaveBeenCalled(); expect(button('Оновити варіанти AMG').disabled).toBe(false)
})
it('loading even the same saved date requires a new names observation instead of reusing the prior witness', async () => {
  setup(); render(panel()); fireEvent.click(button('Оновити назви')); await waitFor(() => expect(button('Сформувати').disabled).toBe(false))
  let finish!: (value: ReturnType<typeof amgNames>) => void
  vi.mocked(readAmgDiscountAnalysisChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await choose(); fireEvent.click(button('Відкрити варіант AMG')); await waitFor(() => expect(readAmgDiscountAnalysisChoices).toHaveBeenCalledTimes(2))
  expect(button('Сформувати').disabled).toBe(true); expect(readAmgDiscountAnalysis).not.toHaveBeenCalled()
  await act(async () => { finish({ ...amgNames(), RequestedCounterparties: [amgParty], RequestedProducts: [amgProduct] }) })
  await waitFor(() => expect(button('Сформувати').disabled).toBe(false))
})
