import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readWip } from '../api/originalWorkInProgressApi'
import { wipCapability, wipRef, wipResult } from '../testing/originalWorkInProgressFixtures'
import { normalizeWip, wipDefaults, type WipResult } from '../data/originalWorkInProgress'
import { OriginalWorkInProgressPanel } from './OriginalWorkInProgressPanel'
vi.mock('../api/originalWorkInProgressApi', () => ({ readWip: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalWorkInProgressPanel capability={wipCapability} callerKey={caller} canGenerate={allowed} initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
it('actual WIP screen preserves division group article hierarchy and every native default-four cell', async () => {
  vi.clearAllMocks(); vi.mocked(readWip).mockImplementation(async request => normalizeWip(wipResult(request), request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const table = await screen.findByRole('table'), row = within(table).getByRole('cell', { name: 'Без статті' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(c => c.textContent)).toEqual(['Наш підрозділ', 'Наша група', 'Без статті', '10.00', '0.00', '0.00', '8.00'])
  expect(within(table).getAllByRole('columnheader').filter(h => h.closest('thead'))).toHaveLength(7)
  expect(vi.mocked(readWip).mock.calls[0][0].Measures).toEqual(wipDefaults); for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('optional native material quantity invalidates prior output and adds the exact raw stored quantity cell', async () => {
  vi.clearAllMocks(); vi.mocked(readWip).mockImplementation(async request => normalizeWip(wipResult(request), request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('checkbox', { name: 'НоменклатураЗатратКоличество' })); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table'), row = within(table).getByRole('cell', { name: 'Наша стаття' }).closest('tr')!
  expect(within(row).getAllByRole('cell').slice(3).map(c => c.textContent)).toEqual(['0.00', '0.00', '3.000', '2.00', '0.00']); expect(vi.mocked(readWip).mock.calls[1][0].Measures).toContain('НоменклатураЗатратКоличество')
})
it('all three actual human filters remain removable after admitted complete empty choices', async () => {
  vi.clearAllMocks(); vi.mocked(readWip).mockImplementation(async request => normalizeWip(wipResult(request), request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Підрозділи', 'Наш підрозділ'], ['Номенклатурні групи', 'Наша група'], ['Статті витрат', 'Наша стаття']]) { fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name })) }
  vi.mocked(readWip).mockImplementation(async request => normalizeWip({ ...wipResult(request), Rows: [], Totals: Object.fromEntries(request.Measures.map(m => [m, m === 'НоменклатураЗатратКоличество' ? '0.000' : '0.00'])), Choices: { Подразделение: [], НоменклатурнаяГруппа: [], СтатьяЗатрат: [] } }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readWip).mock.calls[1][0]).toMatchObject({ Divisions: [wipRef(1)], ProductGroups: [wipRef(2)], CostArticles: [wipRef(3)] })
  for (const field of ['Підрозділи', 'Номенклатурні групи', 'Статті витрат']) { const input = screen.getByRole('combobox', { name: field }) as HTMLInputElement; expect(input.disabled).toBe(false); fireEvent.keyDown(input, { key: 'Backspace' }) }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readWip).toHaveBeenCalledTimes(3)); expect(vi.mocked(readWip).mock.calls[2][0]).toMatchObject({ Divisions: [], ProductGroups: [], CostArticles: [] })
})
it('missing ordinary opening or movement month never displays partial balances or enables export', async () => {
  vi.clearAllMocks(); vi.mocked(readWip).mockImplementation(async request => normalizeWip({ ...wipResult(request), Available: false, NormalInputsComplete: false, Code: 'original_work_in_progress_month_publication_unavailable', Rows: [], Totals: null, InputWitnessSha256: null, ResultSha256: null, Choices: { Подразделение: [], НоменклатурнаяГруппа: [], СтатьяЗатрат: [] }, Dependency: { Kind: 'month_publication_unavailable', MissingMonth: '2026-09-01' } }, request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Для повного звіту потрібні початкові залишки/); expect(screen.queryByRole('table')).toBeNull(); for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller replacement aborts the original request and cannot revive late rows or exports', async () => {
  vi.clearAllMocks(); let complete!: (r: WipResult) => void; vi.mocked(readWip).mockImplementation(() => new Promise(resolve => { complete = resolve })); const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readWip).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readWip).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true); await act(async () => { complete(wipResult()) }); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('permission denial cannot dispatch a dedicated WIP request', () => { vi.clearAllMocks(); render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readWip).not.toHaveBeenCalled() })
