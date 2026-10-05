import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readMoneyFlow } from '../api/originalMoneyFlowAnalysisApi'
import { moneyFlowDefaults, moneyFlowFilters, moneyFlowLabels, moneyFlowRequestFields, type MoneyFlowResult } from '../data/originalMoneyFlowAnalysis'
import { moneyFlowXlsx } from '../data/originalMoneyFlowAnalysisExport'
import { emptyMoneyFlow, moneyFlowCapability, moneyFlowRef, moneyFlowResponse, unavailableMoneyFlow } from '../testing/originalMoneyFlowAnalysisFixtures'
import { OriginalMoneyFlowAnalysisPanel } from './OriginalMoneyFlowAnalysisPanel'
vi.mock('../api/originalMoneyFlowAnalysisApi', () => ({ readMoneyFlow: vi.fn() }))
vi.mock('../data/originalMoneyFlowAnalysisExport', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/originalMoneyFlowAnalysisExport')>()
  return { ...actual, moneyFlowXlsx: vi.fn() }
})
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalMoneyFlowAnalysisPanel
  capability={moneyFlowCapability} callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
function setup() { vi.resetAllMocks(); vi.mocked(readMoneyFlow).mockImplementation(async request => moneyFlowResponse(request)) }
async function select(label: string, name: string) {
  const input = screen.getByRole('combobox', { name: label }); fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name })); fireEvent.blur(input)
}
it('opens exactly four income/net defaults, six choices and Organization→Article amounts without pivot columns', async () => {
  setup(); render(panel()); expect(screen.getAllByRole('checkbox')).toHaveLength(6)
  expect(screen.getAllByRole('checkbox').filter(box => (box as HTMLInputElement).checked)).toHaveLength(4)
  expect((screen.getByRole('checkbox', { name: 'Расход (вал.)' }) as HTMLInputElement).checked).toBe(false)
  expect((screen.getByRole('checkbox', { name: 'Расход (упр.)' }) as HTMLInputElement).checked).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table')
  expect(vi.mocked(readMoneyFlow).mock.calls[0][0].Measures).toEqual(moneyFlowDefaults)
  const rows = within(table).getAllByRole('row'); expect(rows).toHaveLength(6)
  expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Перша організація', 'Оплата', '12.34', '0.00', '50.00', '46.00'])
  expect(within(table).getAllByRole('columnheader').filter(cell => cell.closest('thead'))).toHaveLength(6)
})
it('missing real Division and Project names disable those filters independently without hiding unfiltered amounts', async () => {
  setup(); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).disabled).toBe(false)
  for (const name of ['Підрозділ', 'Проєкт']) expect((screen.getByRole('combobox', { name }) as HTMLInputElement).disabled).toBe(true)
  for (const key of [moneyFlowRef(1), moneyFlowRef(3), moneyFlowRef(4)]) expect(screen.queryByText(key)).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('independent real named filter keys survive measure changes without reducing canonical choices', async () => {
  setup(); vi.mocked(readMoneyFlow).mockImplementationOnce(async request => moneyFlowResponse(request, true)).mockImplementation(async request => emptyMoneyFlow(request, true))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  const first = moneyFlowResponse(undefined, true)
  for (const field of moneyFlowFilters) await select(moneyFlowLabels[field], first.Choices[field][0].Caption)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Расход (вал.)' })); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readMoneyFlow).toHaveBeenCalledTimes(2))
  const request = vi.mocked(readMoneyFlow).mock.calls[1][0]
  for (const field of moneyFlowFilters) expect(request[moneyFlowRequestFields[field]]).toEqual([first.Choices[field][0].Key])
  expect(request.Measures).toEqual(['СуммаПриходВал', 'СуммаРасходВал', 'ДенежныйПотокВал', 'СуммаПриходУпр', 'ДенежныйПотокУпр'])
})
it('an explicit selection remains clearable when the next period has no names and is never shown as an opaque option', async () => {
  setup(); vi.mocked(readMoneyFlow).mockImplementationOnce(async request => moneyFlowResponse(request)).mockImplementation(async request => {
    const result = emptyMoneyFlow(request); result.Choices.Организация = []; return result
  })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); await select('Організація', 'Перша організація')
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-09-13' } }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readMoneyFlow).mock.calls[1][0]).toMatchObject({ Through: '2026-09-13', Organizations: [moneyFlowRef(1)] })
  expect(screen.queryByText(moneyFlowRef(1))).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Очистити відбір: Організація (1)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readMoneyFlow).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readMoneyFlow).mock.calls[2][0].Organizations).toEqual([])
})
it('no resources or invalid dates block I/O and clear the previous completed exports', async () => {
  setup(); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  for (const box of screen.getAllByRole('checkbox')) if ((box as HTMLInputElement).checked) fireEvent.click(box)
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Приход (вал.)' })); fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-09-09' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readMoneyFlow).toHaveBeenCalledTimes(1)
})
it('unavailable normal parents or document attributes expose no partial grid and no export', async () => {
  setup(); vi.mocked(readMoneyFlow).mockResolvedValue(unavailableMoneyFlow()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Потрібні повні звичайні рухи коштів/); expect(screen.queryByRole('table')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('a refused next Snapshot clears prior named choices while retaining the explicit filter for clearing', async () => {
  setup(); vi.mocked(readMoneyFlow).mockImplementationOnce(async request => moneyFlowResponse(request)).mockImplementation(async request => unavailableMoneyFlow(request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); await select('Організація', 'Перша організація')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Потрібні повні звичайні рухи коштів/)
  expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).disabled).toBe(true)
  expect(screen.queryByRole('table')).toBeNull(); expect(screen.getByRole('button', { name: 'Очистити відбір: Організація (1)' })).toBeTruthy()
})
it.each(['caller', 'permission'])('changed %s cancels original work and ignores late result and named options', async kind => {
  setup(); let finish!: (result: MoneyFlowResult) => void; vi.mocked(readMoneyFlow).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readMoneyFlow).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readMoneyFlow).mock.calls[0][1]; view.rerender(kind === 'caller' ? panel('caller2') : panel('caller1', false)); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(moneyFlowResponse(undefined, true)) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).disabled).toBe(true)
})
it('deferred workbook ABA cannot download after caller scope changes and returns', async () => {
  setup(); let finish!: (blob: Blob) => void; vi.mocked(moneyFlowXlsx).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}), view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); fireEvent.click(screen.getByRole('button', { name: 'XLSX' }))
  await waitFor(() => expect(moneyFlowXlsx).toHaveBeenCalledTimes(1)); const completed = vi.mocked(moneyFlowXlsx).mock.calls[0][0]
  expect(completed.Measures).toEqual(moneyFlowDefaults); expect(completed.Rows[0].Caption).toBe('Перша організація')
  view.rerender(panel('caller2')); view.rerender(panel()); await act(async () => { finish(new Blob(['old'])) }); expect(click).not.toHaveBeenCalled(); click.mockRestore()
})
it('missing caller and denied report permission keep generation and exports closed', () => {
  setup(); const view = render(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readMoneyFlow).not.toHaveBeenCalled()
  view.rerender(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readMoneyFlow).not.toHaveBeenCalled()
})
