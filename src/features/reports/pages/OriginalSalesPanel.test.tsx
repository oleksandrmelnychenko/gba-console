import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readSales } from '../api/originalSalesApi'
import { emptySales, missingSales, salesCapability, salesDivision, salesParty, salesProduct, salesProject, salesResponse } from '../testing/originalSalesFixtures'
import { normalizeSales, salesDefaults, salesRequest, type SalesResult } from '../data/originalSales'
import { OriginalSalesPanel } from './OriginalSalesPanel'
vi.mock('../api/originalSalesApi', () => ({ readSales: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalSalesPanel capability={salesCapability} callerKey={caller} canGenerate={allowed}
  initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
it('actual screen uses own two-level hierarchy and both signed default cells without any price selector', async () => {
  vi.clearAllMocks(); vi.mocked(readSales).mockResolvedValue(salesResponse()); render(panel())
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole('combobox', { name: 'Тип ціни Fenix' })).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок контрагента'); const table = screen.getByRole('table'), row = within(table).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(c => c.textContent)).toEqual(['Наш контрагент', 'Наш товар', '-12.00', '-5.000'])
  expect(within(table).getAllByRole('columnheader').filter(h => h.closest('thead'))).toHaveLength(4)
  expect(vi.mocked(readSales).mock.calls[0][0].Measures).toEqual(salesDefaults)
  for (const f of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: f }) as HTMLButtonElement).disabled).toBe(false)
})
it('selecting an optional report-unit resource invalidates the old result and sends that exact selected measure', async () => {
  vi.clearAllMocks(); vi.mocked(readSales).mockResolvedValue(salesResponse()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок контрагента')
  fireEvent.click(screen.getByRole('checkbox', { name: 'КоличествоЕдиницОтчетов' })); expect(screen.queryByText('Підсумок контрагента')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  vi.mocked(readSales).mockImplementation(async request => normalizeSales({ ...salesResponse(request.Measures), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readSales).toHaveBeenCalledTimes(2)); expect(vi.mocked(readSales).mock.calls[1][0].Measures).toContain('КоличествоЕдиницОтчетов')
})
it('all four actual selected human controls remain clearable after a genuinely complete empty result', async () => {
  vi.clearAllMocks(); vi.mocked(readSales).mockImplementation(async request => normalizeSales({ ...salesResponse(), ...request }, request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Контрагенти', 'Наш контрагент'], ['Товари', 'Наш товар'], ['Проєкти', 'Наш проєкт'], ['Підрозділи', 'Наш підрозділ']]) { fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name })) }
  vi.mocked(readSales).mockImplementation(async request => normalizeSales({ ...emptySales(), ...request }, request)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readSales).mock.calls[1][0]).toMatchObject({ Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  for (const field of ['Контрагенти', 'Товари', 'Проєкти', 'Підрозділи']) { const input = screen.getByRole('combobox', { name: field }) as HTMLInputElement; expect(input.disabled).toBe(false); fireEvent.keyDown(input, { key: 'Backspace' }) }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readSales).toHaveBeenCalledTimes(3)); expect(vi.mocked(readSales).mock.calls[2][0]).toMatchObject({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
})
it('exact missing ordinary unit metadata never shows partial cells or enables any export', async () => {
  vi.clearAllMocks(); const r = missingSales(); vi.mocked(readSales).mockResolvedValue(normalizeSales(r, salesRequest(salesCapability, r.From, r.Through, { Counterparties: [], Products: [], Projects: [], Divisions: [] })))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Для повного звіту потрібні всі місячні продажі/); expect(screen.queryByRole('table')).toBeNull()
  for (const f of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: f }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller replacement aborts the original request and late rows cannot repopulate the new caller scope', async () => {
  vi.clearAllMocks(); let complete!: (r: SalesResult) => void; vi.mocked(readSales).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readSales).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readSales).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true); await act(async () => { complete(salesResponse()) }); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('permission denial cannot dispatch an exact Sales request', () => {
  vi.clearAllMocks(); render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readSales).not.toHaveBeenCalled()
})

it('new ordinary project and division names become exact selectable filters while unavailable names never replace signed resource cells', async () => {
  vi.clearAllMocks();
  vi.mocked(readSales).mockImplementationOnce(async request => normalizeSales({ ...salesResponse(), ...request,
    Choices: { ...salesResponse().Choices, 'Проект': [], 'Подразделение': [] }, MissingCaptionMappings: ['Проект', 'Подразделение'] }, request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок контрагента')
  for (const field of ['Проєкти', 'Підрозділи']) expect((screen.getByRole('combobox', { name: field }) as HTMLInputElement).disabled).toBe(true)
  const first = within(screen.getByRole('table')).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(first).getAllByRole('cell').slice(2).map(c => c.textContent)).toEqual(['-12.00', '-5.000'])
  vi.mocked(readSales).mockImplementation(async request => normalizeSales({ ...salesResponse(), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Проєкти' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Проєкти', 'Наш проєкт'], ['Підрозділи', 'Наш підрозділ']]) {
    fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readSales).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readSales).mock.calls[2][0]).toMatchObject({ Projects: [salesProject], Divisions: [salesDivision] })
  const row = within(await screen.findByRole('table')).getByRole('cell', { name: 'Наш товар' }).closest('tr')!
  expect(within(row).getAllByRole('cell').slice(2).map(c => c.textContent)).toEqual(['-12.00', '-5.000'])
})
