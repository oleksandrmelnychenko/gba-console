import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPriceSalesTypes, readPriceSales } from '../api/originalPriceTypeSalesApi'
import { emptySales, missingSales, salesCapability, salesDivision, salesParty, salesProduct, salesProject, salesResponse, salesType } from '../testing/priceTypeSalesFixtures'
import { normalizePriceSales, priceSalesDefaults, priceSalesRequest, type PriceSalesResult } from '../data/originalPriceTypeSales'
import { OriginalPriceTypeSalesPanel } from './OriginalPriceTypeSalesPanel'
vi.mock('../api/originalPriceTypeSalesApi', () => ({ getPriceSalesTypes: vi.fn(), readPriceSales: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalPriceTypeSalesPanel capability={salesCapability} callerKey={caller} canGenerate={allowed}
  initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
function mockTypes() { vi.mocked(getPriceSalesTypes).mockResolvedValue([{ Key: salesType, Caption: 'Наш тип ціни' }]) }
async function chooseType() { await waitFor(() => expect((screen.getByRole('combobox', { name: 'Тип ціни Fenix' }) as HTMLInputElement).disabled).toBe(false)); fireEvent.click(screen.getByRole('combobox', { name: 'Тип ціни Fenix' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш тип ціни' })) }
it('actual screen uses named selected type two-level hierarchy and all signed default four cells', async () => {
  vi.clearAllMocks(); mockTypes(); vi.mocked(readPriceSales).mockResolvedValue(salesResponse()); render(panel())
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок контрагента'); const table = screen.getByRole('table'), row = within(table).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(c => c.textContent)).toEqual(['Наш контрагент', 'Наш товар', '-12.00', '-8.00', '-4.00', '-5.000'])
  expect(within(table).getAllByRole('columnheader').filter(h => h.closest('thead'))).toHaveLength(6)
  expect(vi.mocked(readPriceSales).mock.calls[0][0].Measures).toEqual(priceSalesDefaults)
  for (const f of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: f }) as HTMLButtonElement).disabled).toBe(false)
})
it('selecting an optional report-unit resource invalidates the old result and sends that exact selected measure', async () => {
  vi.clearAllMocks(); mockTypes(); vi.mocked(readPriceSales).mockResolvedValue(salesResponse()); render(panel()); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок контрагента')
  fireEvent.click(screen.getByRole('checkbox', { name: 'КоличествоЕдиницОтчетов' })); expect(screen.queryByText('Підсумок контрагента')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  vi.mocked(readPriceSales).mockImplementation(async request => normalizePriceSales({ ...salesResponse(request.Measures), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPriceSales).toHaveBeenCalledTimes(2)); expect(vi.mocked(readPriceSales).mock.calls[1][0].Measures).toContain('КоличествоЕдиницОтчетов')
})
it('all four actual selected human controls remain clearable after a genuinely complete empty result', async () => {
  vi.clearAllMocks(); mockTypes(); vi.mocked(readPriceSales).mockImplementation(async request => normalizePriceSales({ ...salesResponse(), ...request }, request)); render(panel()); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Контрагенти', 'Наш контрагент'], ['Товари', 'Наш товар'], ['Проєкти', 'Наш проєкт'], ['Підрозділи', 'Наш підрозділ']]) { fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name })) }
  vi.mocked(readPriceSales).mockImplementation(async request => normalizePriceSales({ ...emptySales(), ...request }, request)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readPriceSales).mock.calls[1][0]).toMatchObject({ Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  for (const field of ['Контрагенти', 'Товари', 'Проєкти', 'Підрозділи']) { const input = screen.getByRole('combobox', { name: field }) as HTMLInputElement; expect(input.disabled).toBe(false); fireEvent.keyDown(input, { key: 'Backspace' }) }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPriceSales).toHaveBeenCalledTimes(3)); expect(vi.mocked(readPriceSales).mock.calls[2][0]).toMatchObject({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
})
it('exact missing ordinary unit metadata never shows partial cells or enables any export', async () => {
  vi.clearAllMocks(); mockTypes(); const r = missingSales(); vi.mocked(readPriceSales).mockResolvedValue(normalizePriceSales(r, priceSalesRequest(salesCapability, r.From, r.Through, salesType, { Counterparties: [], Products: [], Projects: [], Divisions: [] })))
  render(panel()); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Для повного звіту потрібні всі місячні продажі/); expect(screen.queryByRole('table')).toBeNull()
  for (const f of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: f }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller replacement aborts the original request and late rows cannot repopulate the new caller scope', async () => {
  vi.clearAllMocks(); mockTypes(); let complete!: (r: PriceSalesResult) => void; vi.mocked(readPriceSales).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPriceSales).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readPriceSales).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true); await act(async () => { complete(salesResponse()) }); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('missing named price types and permission loss cannot fabricate a raw choice or dispatch a report', async () => {
  vi.clearAllMocks(); vi.mocked(getPriceSalesTypes).mockResolvedValue([]); render(panel()); await screen.findByText('Немає підтверджених назв типів цін у звичайних даних Fenix.')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readPriceSales).not.toHaveBeenCalled(); expect(screen.queryByText(salesType)).toBeNull()
})

it('new ordinary project and division names become exact selectable filters while unavailable names never replace signed resource cells', async () => {
  vi.clearAllMocks(); mockTypes()
  vi.mocked(readPriceSales).mockImplementationOnce(async request => normalizePriceSales({ ...salesResponse(), ...request,
    Choices: { ...salesResponse().Choices, 'Проект': [], 'Подразделение': [] }, MissingCaptionMappings: ['Проект', 'Подразделение'] }, request))
  render(panel()); await chooseType(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок контрагента')
  for (const field of ['Проєкти', 'Підрозділи']) expect((screen.getByRole('combobox', { name: field }) as HTMLInputElement).disabled).toBe(true)
  const first = within(screen.getByRole('table')).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(first).getAllByRole('cell').slice(2).map(c => c.textContent)).toEqual(['-12.00', '-8.00', '-4.00', '-5.000'])
  vi.mocked(readPriceSales).mockImplementation(async request => normalizePriceSales({ ...salesResponse(), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Проєкти' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Проєкти', 'Наш проєкт'], ['Підрозділи', 'Наш підрозділ']]) {
    fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPriceSales).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readPriceSales).mock.calls[2][0]).toMatchObject({ Projects: [salesProject], Divisions: [salesDivision] })
  const row = within(await screen.findByRole('table')).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(row).getAllByRole('cell').slice(2).map(c => c.textContent)).toEqual(['-12.00', '-8.00', '-4.00', '-5.000'])
})
