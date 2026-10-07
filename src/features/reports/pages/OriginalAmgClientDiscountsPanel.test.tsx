import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readAmgDiscountChoices, readAmgDiscounts } from '../api/originalAmgClientDiscountsApi'
import { amgDiscountXlsx } from '../data/originalAmgClientDiscountsExport'
import { amgDiscountFields, amgDiscountLabels, type AmgDiscountChoices, type AmgDiscountResult } from '../data/originalAmgClientDiscounts'
import { amgChoices, amgClient, amgEmpty, amgMissing, amgProduct, amgReadiness, amgResult, amgWitness } from '../testing/originalAmgClientDiscountsFixtures'
import { OriginalAmgClientDiscountsPanel } from './OriginalAmgClientDiscountsPanel'
vi.mock('../api/originalAmgClientDiscountsApi', () => ({ readAmgDiscounts: vi.fn(), readAmgDiscountChoices: vi.fn() }))
vi.mock('../data/originalAmgClientDiscountsExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalAmgClientDiscountsExport')>(); return { ...actual, amgDiscountXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalAmgClientDiscountsPanel readiness={amgReadiness}
  callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
it('renders authentic completed recipient/product/direct region and exact signed percentage without a sum', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscounts).mockResolvedValue(amgResult()); render(panel())
  for (const f of amgDiscountFields) expect((screen.getByRole('combobox', { name: amgDiscountLabels[f] }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('cell').map(v => v.textContent)).toEqual(['Клієнт AMG', 'Товар AMG', 'Київ', '-12.34'])
  expect(screen.queryByText('Разом')).toBeNull(); expect(screen.queryByText(amgProduct)).toBeNull(); expect(screen.queryByText(amgClient.Reference)).toBeNull()
  expect(vi.mocked(readAmgDiscounts).mock.calls[0][0]).toMatchObject({ Through: '2026-09-30', Products: [], Recipients: [], RegionCodes: [], ChoicesWitnessSha256: null })
  for (const f of ['CSV', 'XLSX', 'PDF']) expect(button(f).disabled).toBe(false)
})
it('enables available product names independently while missing recipient and region families stay disabled', async () => {
  vi.clearAllMocks(); const names = amgChoices(); names.FieldAvailability.ПолучательСкидки = false; names.FieldAvailability.КодПоРегиону = false
  names.Choices.ПолучательСкидки = []; names.Choices.КодПоРегиону = []; names.MissingFamilies = ['ПолучательСкидки', 'КодПоРегиону']; names.HumanChoicesAvailable = false
  vi.mocked(readAmgDiscountChoices).mockResolvedValue(names); render(panel()); fireEvent.click(button('Завантажити актуальні назви'))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Отримувач знижки' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Прямий код регіону' }) as HTMLInputElement).disabled).toBe(true)
})
it('submits a full typed recipient with the current choice witness and invalidates the prior result on reload', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountChoices).mockResolvedValue(amgChoices()); vi.mocked(readAmgDiscounts).mockImplementation(async request => amgResult(request))
  render(panel()); fireEvent.click(button('Завантажити актуальні назви')); const recipient = screen.getByRole('combobox', { name: 'Отримувач знижки' })
  await waitFor(() => expect((recipient as HTMLInputElement).disabled).toBe(false)); fireEvent.click(recipient)
  fireEvent.click(await screen.findByRole('option', { name: 'Клієнт AMG' })); fireEvent.blur(recipient); fireEvent.click(button('Сформувати'))
  await screen.findByRole('table'); expect(vi.mocked(readAmgDiscounts).mock.calls[0][0]).toMatchObject({ Recipients: [amgClient], ChoicesWitnessSha256: amgWitness })
  fireEvent.click(button('Завантажити актуальні назви')); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  await waitFor(() => expect(button('Завантажити актуальні назви').disabled).toBe(false)); fireEvent.click(button('Сформувати'))
  await waitFor(() => expect(readAmgDiscounts).toHaveBeenCalledTimes(2)); expect(vi.mocked(readAmgDiscounts).mock.calls[1][0].Recipients).toEqual([])
})
it('keeps complete empty exports available while missing input has no grid or export', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscounts).mockResolvedValueOnce(amgMissing()).mockResolvedValueOnce(amgEmpty()); render(panel()); fireEvent.click(button('Сформувати'))
  await screen.findByText(/Повні узгоджені дані/); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(button('CSV').disabled).toBe(false)
})
it('denied permission prevents I/O and cancels an original preview across permission ABA', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountResult) => void; vi.mocked(readAmgDiscounts).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel(false)); fireEvent.click(button('Сформувати')); fireEvent.click(button('Завантажити актуальні назви')); expect(readAmgDiscounts).not.toHaveBeenCalled(); expect(readAmgDiscountChoices).not.toHaveBeenCalled()
  view.rerender(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readAmgDiscounts).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscounts).mock.calls[0][1]; view.rerender(panel(false)); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('caller changes cancel a late original choice response even when the same caller returns', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountChoices) => void; vi.mocked(readAmgDiscountChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Завантажити актуальні назви')); await waitFor(() => expect(readAmgDiscountChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readAmgDiscountChoices).mock.calls[0][1]
  view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgChoices()) }); expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
})
it('changing the date clears the completed grid and choices and rejects an invalid date before dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(readAmgDiscountChoices).mockResolvedValue(amgChoices()); vi.mocked(readAmgDiscounts).mockResolvedValue(amgResult())
  render(panel()); fireEvent.click(button('Завантажити актуальні назви')); await waitFor(() => expect(button('Завантажити актуальні назви').disabled).toBe(false))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } })
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '' } }); fireEvent.click(button('Сформувати')); expect(readAmgDiscounts).toHaveBeenCalledTimes(1)
})
it('a deferred XLSX is never downloaded after caller replacement and return to the original caller', async () => {
  vi.clearAllMocks(); let finish!: (v: Blob) => void; vi.mocked(amgDiscountXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readAmgDiscounts).mockResolvedValue(amgResult())
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(amgDiscountXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['stale'])) }); expect(create).not.toHaveBeenCalled()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
