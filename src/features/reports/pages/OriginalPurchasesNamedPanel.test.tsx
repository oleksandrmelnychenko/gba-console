import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readPurchases, readPurchasesChoices } from '../api/originalPurchasesApi'
import { purchasesXlsx } from '../data/originalPurchasesExport'
import type { PurchasesChoices } from '../data/originalPurchasesChoices'
import { purchasesCapability, purchasesParty, purchasesProduct, purchasesResponse, purchasesStatus } from '../testing/originalPurchasesFixtures'
import { namedPurchasesResponse, purchasesDistributionProject, purchasesMainProject, purchasesMissingNames, purchasesNamedChoices, purchasesStatusChoices, statusNamedPurchasesResponse } from '../testing/originalPurchasesNamedFixtures'
import { OriginalPurchasesPanel } from './OriginalPurchasesPanel'

vi.mock('../api/originalPurchasesApi', () => ({ readPurchases: vi.fn(), readPurchasesChoices: vi.fn() }))
vi.mock('../data/originalPurchasesExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalPurchasesExport')>()
  return { ...actual, purchasesXlsx: vi.fn() }
})
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalPurchasesPanel capability={purchasesCapability}
  callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
function setup() {
  vi.resetAllMocks(); vi.mocked(readPurchasesChoices).mockImplementation(async request => purchasesNamedChoices(request))
  vi.mocked(readPurchases).mockImplementation(async request => namedPurchasesResponse(request))
}
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(false))
}
async function select(label: string, option: string) {
  const input = screen.getByRole('combobox', { name: label }); fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name: option })); fireEvent.blur(input)
}
it('enables the admitted Status field, sends its current witness and displays the returned caption', async () => {
  setup(); vi.mocked(readPurchasesChoices).mockImplementation(async request => purchasesStatusChoices(request))
  vi.mocked(readPurchases).mockImplementation(async request => statusNamedPurchasesResponse(request))
  render(panel()); await load()
  expect((screen.getByRole('combobox', { name: 'Статуси партій' }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.queryByText('Назви ще недоступні: .')).toBeNull()
  await select('Статуси партій', 'Власна партія'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const table = await screen.findByRole('table'); expect(within(table).getAllByText('Власна партія')).toHaveLength(4)
  expect(vi.mocked(readPurchases).mock.calls[0][0]).toMatchObject({ Statuses: [purchasesStatus], NamedChoiceWitnesses: { СтатусПартии: '2'.repeat(64) } })
  expect(screen.queryByText(purchasesStatus)).toBeNull()
  expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false)
})
it('enables four named fields independently and preserves both full Project keys with exact witnesses', async () => {
  setup(); render(panel()); await load()
  expect((screen.getByRole('combobox', { name: 'Статуси партій' }) as HTMLInputElement).disabled).toBe(true)
  await select('Контрагенти', 'Постачальник'); await select('Номенклатура', 'Перший товар'); await select('Підрозділи', 'Відділ закупівель')
  await select('Проєкти', 'Розподіл закупівель'); await select('Проєкти', 'Основний проєкт (позначено на видалення)')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table')
  expect(within(table).getAllByText('Постачальник').length).toBeGreaterThan(0); expect(within(table).getByText('Перший товар, базова одиниця недоступна')).toBeTruthy()
  expect(vi.mocked(readPurchases).mock.calls[0][0]).toMatchObject({ Statuses: [], Counterparties: [purchasesParty], Products: [purchasesProduct],
    Projects: [purchasesDistributionProject, purchasesMainProject], NamedChoiceWitnesses: { Контрагент: 'c'.repeat(64), Номенклатура: 'd'.repeat(64), Подразделение: 'e'.repeat(64), Проект: 'f'.repeat(64) } })
  expect(vi.mocked(readPurchasesChoices).mock.calls[0][0]).toMatchObject({ Statuses: [], Counterparties: [], Products: [], Divisions: [], Projects: [], Measures: ['КоличествоБазовыхЕд', 'СтоимостьОборот', 'НДСОборот', 'ВесОборот'] })
  for (const key of [purchasesParty, purchasesProduct, purchasesDistributionProject, purchasesMainProject]) expect(screen.queryByText(key)).toBeNull()
})
it('one missing named family keeps only that field unavailable and does not block another field', async () => {
  setup(); vi.mocked(readPurchasesChoices).mockImplementationOnce(async request => {
    const names = purchasesNamedChoices(request); names.FieldAvailability.Номенклатура = false; names.Choices.Номенклатура = []
    delete names.FieldWitnessSha256.Номенклатура; names.MissingFamilies.push('Номенклатура'); return names
  })
  render(panel()); await load(); expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
  await select('Контрагенти', 'Постачальник'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readPurchases).mock.calls[0][0]).toMatchObject({ Counterparties: [purchasesParty], Products: [], NamedChoiceWitnesses: { Контрагент: 'c'.repeat(64) } })
})
it('complete empty choices remain measured empty while absent names preserve unfiltered amounts', async () => {
  setup(); vi.mocked(readPurchasesChoices).mockImplementationOnce(async request => {
    const names = purchasesNamedChoices(request); names.Choices.Номенклатура = []; return names
  }).mockResolvedValueOnce(purchasesMissingNames())
  vi.mocked(readPurchases).mockResolvedValue(purchasesResponse()); render(panel()); await load()
  expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(false)
  await screen.findByText('Для перевірених порожніх полів немає варіантів відбору.')
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Завантажити назви' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readPurchases).mock.calls[0][0]).toMatchObject({ Counterparties: [], Products: [], Divisions: [], Projects: [] })
  expect(screen.queryByRole('option', { name: 'Перший товар' })).toBeNull()
})
it('caller ABA replacement aborts the original choices and late names cannot enable any filter', async () => {
  setup(); let finish!: (value: PurchasesChoices) => void
  vi.mocked(readPurchasesChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' }))
  await waitFor(() => expect(readPurchasesChoices).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readPurchasesChoices).mock.calls[0][1]
  view.rerender(panel('caller2')); view.rerender(panel('caller1')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(purchasesNamedChoices()) })
  expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true); expect(screen.queryByText('Постачальник')).toBeNull()
})
it('a period edit removes old named selections and never silently reuses their parent witnesses', async () => {
  setup(); render(panel()); await load(); await select('Контрагенти', 'Постачальник')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-09-13' } })
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readPurchases).mock.calls[1][0]).toMatchObject({ Through: '2026-09-13', Counterparties: [] })
  expect(vi.mocked(readPurchases).mock.calls[1][0].NamedChoiceWitnesses).toBeUndefined(); expect(readPurchasesChoices).toHaveBeenCalledTimes(1)
})
it('resource and filter edits invalidate completed files without reducing canonical named coverage', async () => {
  setup(); render(panel()); await load(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  await select('Показники', 'Кількість у звітних одиницях'); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); expect(screen.getAllByText('0.667').length).toBeGreaterThan(0)
  await select('Контрагенти', 'Постачальник'); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'PDF' }) as HTMLButtonElement).disabled).toBe(true); expect(readPurchasesChoices).toHaveBeenCalledTimes(1)
})
it('a fresh catalogue reload resets filters and replaces the previous field witness instead of stale captions', async () => {
  setup(); vi.mocked(readPurchasesChoices).mockImplementationOnce(async request => purchasesNamedChoices(request))
    .mockImplementationOnce(async request => {
      const next = purchasesNamedChoices(request); next.FieldWitnessSha256.Контрагент = '2'.repeat(64); next.ResultSha256 = '3'.repeat(64)
      next.Choices.Контрагент[0].Caption = 'Новий постачальник'; return next
    })
  vi.mocked(readPurchases).mockImplementation(async request => {
    const result = namedPurchasesResponse(request)
    if (request.NamedChoiceWitnesses?.Контрагент === '2'.repeat(64)) {
      result.NamedChoiceWitnesses = { ...result.NamedChoiceWitnesses, Контрагент: '2'.repeat(64) }; result.Rows[0].Children[0].Caption = 'Новий постачальник'
    }
    return result
  })
  render(panel()); await load(); await select('Контрагенти', 'Постачальник'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  await load(); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(true)
  await select('Контрагенти', 'Новий постачальник'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readPurchases).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readPurchases).mock.calls[1][0].NamedChoiceWitnesses).toEqual({ Контрагент: '2'.repeat(64) })
})
it('unavailable permissions or a missing caller dispatch neither names nor preview', () => {
  setup(); const view = render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' }))
  view.rerender(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect(readPurchasesChoices).not.toHaveBeenCalled(); expect(readPurchases).not.toHaveBeenCalled()
})
it('a stale current field witness yields an explicit dependency without rows zero totals or exports', async () => {
  setup(); vi.mocked(readPurchases).mockImplementationOnce(async request => ({ ...namedPurchasesResponse(request), Available: false, NormalInputsComplete: false,
    Code: 'original_purchases_named_selector_current_witness_unavailable', InputWitnessSha256: null, ResultSha256: null, Rows: [], Totals: null,
    Dependency: { Kind: 'named_selector_current_witness_unavailable', MissingMonth: null, Product: null } }))
  render(panel()); await load(); await select('Контрагенти', 'Постачальник'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Назви або повні дані змінилися/); expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByText('0.000')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('deferred named-result XLSX remains cancelled after caller loss and return', async () => {
  setup(); let finish!: (value: Blob) => void; vi.mocked(purchasesXlsx).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const prior = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), create = vi.fn(() => 'blob:stale')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  try {
    const view = render(panel()); await load(); await select('Контрагенти', 'Постачальник')
    fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); await waitFor(() => expect(purchasesXlsx).toHaveBeenCalledTimes(1))
    view.rerender(panel('caller2')); view.rerender(panel('caller1'))
    await act(async () => { finish(new Blob(['stale'])) }); expect(create).not.toHaveBeenCalled()
  } finally { if (prior) Object.defineProperty(URL, 'createObjectURL', prior); else Reflect.deleteProperty(URL, 'createObjectURL') }
})
