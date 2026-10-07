import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readPlannedFlow } from '../api/originalPlannedCashFlowApi'
import { flowCapability, flowResult, missingFlow } from '../testing/originalPlannedCashClientFixtures'
import type { PlannedFlowResult } from '../data/originalPlannedCashFlow'
import { OriginalPlannedCashFlowPanel } from './OriginalPlannedCashFlowPanel'
vi.mock('../api/originalPlannedCashFlowApi', () => ({ readPlannedFlow: vi.fn(), readPlannedFlowChoices: vi.fn() }))
const panel = (caller = 'caller1', permission = true) => <MantineProvider env="test"><I18nProvider><OriginalPlannedCashFlowPanel
  capability={flowCapability} callerKey={caller} canGenerate={permission} initialFrom="2026-10-01" initialThrough="2026-10-04" /></I18nProvider></MantineProvider>
it('own four default resources render signed server cells and every unsupported named filter stays disabled', async () => {
  vi.clearAllMocks(); vi.mocked(readPlannedFlow).mockResolvedValue(flowResult()); render(panel())
  for (const field of ['Сценарій', 'Проєкт', 'Підрозділ']) expect((screen.getByRole('combobox', { name: field }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Операційний план')
  const row = screen.getByRole('cell', { name: 'Операційний план' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Операційний план', '-2.00', '-5.00', '4.00', '5.00'])
  expect(readPlannedFlow).toHaveBeenCalledWith(expect.objectContaining({ Scenarios: [], Projects: [], Departments: [] }), expect.any(AbortSignal))
})
it('incomplete own department data produces dependency text without rows or export controls', async () => {
  vi.clearAllMocks(); vi.mocked(readPlannedFlow).mockResolvedValue(missingFlow()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Не для всіх документів планування відомий підрозділ.')
  expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull()
})
it('known empty displays no rows and preserves absent totals rather than creating zero cells', async () => {
  vi.clearAllMocks(); vi.mocked(readPlannedFlow).mockResolvedValue({ ...flowResult(), Rows: [], Totals: null }); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(screen.queryByRole('columnheader', { name: 'Разом' })).toBeNull()
})
it('missing article captions never display the technical reference and preserve separate values', async () => {
  vi.clearAllMocks(); const result = flowResult(); result.Rows[0].Caption = null; vi.mocked(readPlannedFlow).mockResolvedValue(result); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Назва недоступна')
  expect(screen.queryByText(result.Rows[0].ArticleReference)).toBeNull()
})
it('period and permission changes clear the previous result while caller changes abort pending responses', async () => {
  vi.clearAllMocks(); vi.mocked(readPlannedFlow).mockResolvedValue(flowResult()); const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Операційний план')
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-10-03' } }); expect(screen.queryByText('Операційний план')).toBeNull()
  let finish!: (result: PlannedFlowResult) => void; vi.mocked(readPlannedFlow).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readPlannedFlow).toHaveBeenCalledTimes(2))
  const signal = vi.mocked(readPlannedFlow).mock.calls[1][1]; view.rerender(panel('caller2', false)); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(flowResult()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
