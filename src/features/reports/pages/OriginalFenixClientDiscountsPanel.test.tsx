import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readFenixDiscountChoices, readFenixDiscounts } from '../api/originalFenixClientDiscountsApi'
import { fenixDiscountXlsx } from '../data/originalFenixClientDiscountsExport'
import { fenixDiscountFields, fenixDiscountLabels, type FenixDiscountChoices, type FenixDiscountResult } from '../data/originalFenixClientDiscounts'
import { fenixChoices, fenixClient, fenixEmpty, fenixMissing, fenixProduct, fenixReadiness, fenixResult, fenixWitness } from '../testing/originalFenixClientDiscountsFixtures'
import { OriginalFenixClientDiscountsPanel } from './OriginalFenixClientDiscountsPanel'
vi.mock('../api/originalFenixClientDiscountsApi', () => ({ readFenixDiscounts: vi.fn(), readFenixDiscountChoices: vi.fn() }))
vi.mock('../data/originalFenixClientDiscountsExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalFenixClientDiscountsExport')>(); return { ...actual, fenixDiscountXlsx: vi.fn() }
})
const panel = (allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalFenixClientDiscountsPanel readiness={fenixReadiness}
  callerKey={caller} canGenerate={allowed} initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
it('renders authentic completed recipient/product/direct region and exact signed percentage without a sum', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscounts).mockResolvedValue(fenixResult()); render(panel())
  for (const f of fenixDiscountFields) expect((screen.getByRole('combobox', { name: fenixDiscountLabels[f] }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(button('Сформувати')); const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('cell').map(v => v.textContent)).toEqual(['Клієнт FENIX', 'Товар FENIX', 'Київ', '-12.34'])
  expect(screen.queryByText('Разом')).toBeNull(); expect(screen.queryByText(fenixProduct)).toBeNull(); expect(screen.queryByText(fenixClient.Reference)).toBeNull()
  expect(vi.mocked(readFenixDiscounts).mock.calls[0][0]).toMatchObject({ Through: '2026-09-30', Products: [], Recipients: [], RegionCodes: [], ChoicesWitnessSha256: null })
  for (const f of ['CSV', 'XLSX', 'PDF']) expect(button(f).disabled).toBe(false)
})
it('enables available product names independently while missing recipient and region families stay disabled', async () => {
  vi.clearAllMocks(); const names = fenixChoices(); names.FieldAvailability.ПолучательСкидки = false; names.FieldAvailability.КодПоРегиону = false
  names.Choices.ПолучательСкидки = []; names.Choices.КодПоРегиону = []; names.MissingFamilies = ['ПолучательСкидки', 'КодПоРегиону']; names.HumanChoicesAvailable = false
  vi.mocked(readFenixDiscountChoices).mockResolvedValue(names); render(panel()); fireEvent.click(button('Завантажити актуальні назви'))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Отримувач знижки' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Прямий код регіону' }) as HTMLInputElement).disabled).toBe(true)
})
it('submits a full typed recipient with the current choice witness and invalidates the prior result on reload', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountChoices).mockResolvedValue(fenixChoices()); vi.mocked(readFenixDiscounts).mockImplementation(async request => fenixResult(request))
  render(panel()); fireEvent.click(button('Завантажити актуальні назви')); const recipient = screen.getByRole('combobox', { name: 'Отримувач знижки' })
  await waitFor(() => expect((recipient as HTMLInputElement).disabled).toBe(false)); fireEvent.click(recipient)
  fireEvent.click(await screen.findByRole('option', { name: 'Клієнт FENIX' })); fireEvent.blur(recipient); fireEvent.click(button('Сформувати'))
  await screen.findByRole('table'); expect(vi.mocked(readFenixDiscounts).mock.calls[0][0]).toMatchObject({ Recipients: [fenixClient], ChoicesWitnessSha256: fenixWitness })
  fireEvent.click(button('Завантажити актуальні назви')); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  await waitFor(() => expect(button('Завантажити актуальні назви').disabled).toBe(false)); fireEvent.click(button('Сформувати'))
  await waitFor(() => expect(readFenixDiscounts).toHaveBeenCalledTimes(2)); expect(vi.mocked(readFenixDiscounts).mock.calls[1][0].Recipients).toEqual([])
})
it('keeps complete empty exports available while missing input has no grid or export', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscounts).mockResolvedValueOnce(fenixMissing()).mockResolvedValueOnce(fenixEmpty()); render(panel()); fireEvent.click(button('Сформувати'))
  await screen.findByText(/Повні узгоджені дані/); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  fireEvent.click(button('Сформувати')); await screen.findByText('У повністю перевіреному зрізі рядків немає.'); expect(button('CSV').disabled).toBe(false)
})
it('denied permission prevents I/O and cancels an original preview across permission ABA', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountResult) => void; vi.mocked(readFenixDiscounts).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel(false)); fireEvent.click(button('Сформувати')); fireEvent.click(button('Завантажити актуальні назви')); expect(readFenixDiscounts).not.toHaveBeenCalled(); expect(readFenixDiscountChoices).not.toHaveBeenCalled()
  view.rerender(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(readFenixDiscounts).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscounts).mock.calls[0][1]; view.rerender(panel(false)); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
})
it('caller changes cancel a late original choice response even when the same caller returns', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountChoices) => void; vi.mocked(readFenixDiscountChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(button('Завантажити актуальні назви')); await waitFor(() => expect(readFenixDiscountChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readFenixDiscountChoices).mock.calls[0][1]
  view.rerender(panel(true, 'caller2')); view.rerender(panel()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixChoices()) }); expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
})
it('changing the date clears the completed grid and choices and rejects an invalid date before dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountChoices).mockResolvedValue(fenixChoices()); vi.mocked(readFenixDiscounts).mockResolvedValue(fenixResult())
  render(panel()); fireEvent.click(button('Завантажити актуальні назви')); await waitFor(() => expect(button('Завантажити актуальні назви').disabled).toBe(false))
  fireEvent.click(button('Сформувати')); await screen.findByRole('table'); fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-10-01' } })
  expect(screen.queryByRole('table')).toBeNull(); expect(button('CSV').disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '' } }); fireEvent.click(button('Сформувати')); expect(readFenixDiscounts).toHaveBeenCalledTimes(1)
})
it('a deferred XLSX is never downloaded after caller replacement and return to the original caller', async () => {
  vi.clearAllMocks(); let finish!: (v: Blob) => void; vi.mocked(fenixDiscountXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.mocked(readFenixDiscounts).mockResolvedValue(fenixResult())
  const old = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); fireEvent.click(button('Сформувати')); await waitFor(() => expect(button('XLSX').disabled).toBe(false)); fireEvent.click(button('XLSX'))
    await waitFor(() => expect(fenixDiscountXlsx).toHaveBeenCalledTimes(1)); view.rerender(panel(true, 'caller2')); view.rerender(panel())
    await act(async () => { finish(new Blob(['stale'])) }); expect(create).not.toHaveBeenCalled()
  } finally { if (old) Object.defineProperty(URL, 'createObjectURL', old); else Reflect.deleteProperty(URL, 'createObjectURL') }
})

it('date ABA never resurrects a previously selected recipient even if the same immutable names return', async () => {
  vi.clearAllMocks(); vi.mocked(readFenixDiscountChoices).mockImplementation(async request => fenixChoices(request))
  vi.mocked(readFenixDiscounts).mockImplementation(async request => fenixResult(request))
  render(panel()); fireEvent.click(button('Завантажити актуальні назви'))
  const recipient = screen.getByRole('combobox', { name: 'Отримувач знижки' })
  await waitFor(() => expect((recipient as HTMLInputElement).disabled).toBe(false)); fireEvent.click(recipient)
  fireEvent.click(await screen.findByRole('option', { name: 'Клієнт FENIX' })); fireEvent.blur(recipient)
  const date = screen.getByLabelText('Дата зрізу')
  fireEvent.change(date, { target: { value: '2026-10-01' } }); fireEvent.change(date, { target: { value: '2026-09-30' } })
  fireEvent.click(button('Завантажити актуальні назви'))
  await waitFor(() => expect(button('Завантажити актуальні назви').disabled).toBe(false)); fireEvent.click(button('Сформувати'))
  await waitFor(() => expect(readFenixDiscounts).toHaveBeenCalledTimes(1))
  expect(vi.mocked(readFenixDiscounts).mock.calls[0][0].Recipients).toEqual([])
})
