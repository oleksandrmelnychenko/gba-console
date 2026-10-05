import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readClientReport } from '../api/originalClientReportApi'
import { clientCapability, clientOrg, clientParty, clientResult, missingClient } from '../testing/originalPlannedCashClientFixtures'
import { normalizeClientResult, type ClientResult } from '../data/originalClientReport'
import { OriginalClientReportPanel } from './OriginalClientReportPanel'
vi.mock('../api/originalClientReportApi', () => ({ readClientReport: vi.fn() }))
const panel = (caller = 'caller1', permission = true) => <MantineProvider env="test"><I18nProvider><OriginalClientReportPanel
  capability={clientCapability} callerKey={caller} canGenerate={permission} initialFrom="2026-10-01" initialThrough="2026-10-04" /></I18nProvider></MantineProvider>
it('actual own three-level hierarchy shows all10 signed resources including quantity scale3 and native default zero prices', async () => {
  vi.clearAllMocks(); vi.mocked(readClientReport).mockResolvedValue(clientResult()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('table'); const leaf = screen.getByRole('cell', { name: 'Наш договір' }).closest('tr')!
  expect(within(leaf).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Наша організація', 'Наш клієнт', 'Наш договір',
    '10.00', '-2.00', '3.00', '-4.00', '-2.500', '0.00', '5.00', '1.250', '0.00', '6.00'])
  expect(screen.getByRole('table').querySelectorAll('thead th')).toHaveLength(13)
})
it('full named choices enable selected requests and exact selectors echo the new request', async () => {
  vi.clearAllMocks(); vi.mocked(readClientReport).mockImplementation(async request => normalizeClientResult({ ...clientResult(),
    Selectors: { Организация: request.Organizations, Контрагент: request.Counterparties, ДоговорКонтрагента: request.Agreements } }, request))
  render(panel()); expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Контрагенти' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш клієнт' }))
  expect(screen.queryByRole('table')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readClientReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readClientReport).mock.calls[1][0]).toMatchObject({ Counterparties: [clientParty], Organizations: [], Agreements: [] })
})
it('a field with incomplete names is disabled while full independent names remain usable and GUID labels never appear', async () => {
  vi.clearAllMocks(); const result = clientResult(); result.Choices.Контрагент![0] = { Key: clientParty, Caption: 'Назва недоступна', CaptionAvailable: false }
  result.Rows[0].Children[0].Caption = 'Назва недоступна'; result.Rows[0].Children[0].CaptionAvailable = false
  vi.mocked(readClientReport).mockResolvedValue(result); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Організації' }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.queryByText(clientParty)).toBeNull(); expect(screen.queryByText(clientOrg)).toBeNull()
})
it('unavailable source generation clears every previous row export and named choice', async () => {
  vi.clearAllMocks(); vi.mocked(readClientReport).mockResolvedValueOnce(clientResult()).mockResolvedValueOnce(missingClient()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Повний початковий борг/)
  expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true)
})
it('fresh full-universe membership changes refuse further selected generation until explicit reset', async () => {
  vi.clearAllMocks(); vi.mocked(readClientReport).mockResolvedValueOnce(clientResult())
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('combobox', { name: 'Контрагенти' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш клієнт' }))
  const empty = clientResult(); empty.Rows = []; empty.Code = 'original_client_report_declared_calendar_empty'; empty.ResultSha256 = 'e'.repeat(64)
  empty.Totals = Object.fromEntries(Object.keys(empty.Totals!).map(key => [key, key.startsWith('Количество') ? '0.000' : '0.00'])) as typeof empty.Totals
  empty.InputWitnessSha256 = 'f'.repeat(64); empty.Choices.Контрагент = []; empty.Selectors.Контрагент = [clientParty]
  vi.mocked(readClientReport).mockResolvedValueOnce(empty); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Назви або склад значень змінилися. Очистьте відбори й сформуйте звіт повторно.')
  expect(screen.queryByText(clientParty)).toBeNull(); expect(screen.getByText('Наш клієнт')).not.toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Очистити відбори й назви' })); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
})
it('date scope resets rows selections and choices including ABA without reusing old caption evidence', async () => {
  vi.clearAllMocks(); vi.mocked(readClientReport).mockResolvedValue(clientResult()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-10-03' } })
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('combobox', { name: 'Організації' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-10-04' } })
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('combobox', { name: 'Організації' }) as HTMLInputElement).disabled).toBe(true)
})
it('caller and permission changes abort original requests and discard late rows and names', async () => {
  vi.clearAllMocks(); let finish!: (result: ClientResult) => void; vi.mocked(readClientReport).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readClientReport).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readClientReport).mock.calls[0][1]; view.rerender(panel('caller2', false)); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(clientResult()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(panel('caller1', true)); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Контрагенти' }) as HTMLInputElement).disabled).toBe(true)
})
