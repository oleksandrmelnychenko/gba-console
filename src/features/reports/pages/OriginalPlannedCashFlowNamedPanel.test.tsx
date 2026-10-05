import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readPlannedFlow, readPlannedFlowChoices } from '../api/originalPlannedCashFlowApi'
import { flowResult } from '../testing/originalPlannedCashClientFixtures'
import { namedFlowCapability, plannedFlowChoices, scenarioKey } from '../testing/originalPlannedCashFlowChoiceFixtures'
import type { PlannedFlowChoices } from '../data/originalPlannedCashFlow'
import { OriginalPlannedCashFlowPanel } from './OriginalPlannedCashFlowPanel'
vi.mock('../api/originalPlannedCashFlowApi', () => ({ readPlannedFlow: vi.fn(), readPlannedFlowChoices: vi.fn() }))
const panel = (caller = 'caller1', permission = true) => <MantineProvider env="test"><I18nProvider><OriginalPlannedCashFlowPanel
  capability={namedFlowCapability} callerKey={caller} canGenerate={permission} initialFrom="2026-10-01" initialThrough="2026-10-04" /></I18nProvider></MantineProvider>
it('Scenario alone becomes searchable while absent Project Department stay disabled and selected preview carries current witness', async () => {
  vi.clearAllMocks(); const choices = plannedFlowChoices(); vi.mocked(readPlannedFlowChoices).mockResolvedValue(choices)
  vi.mocked(readPlannedFlow).mockResolvedValue({ ...flowResult(), Scenarios: [scenarioKey], ChoicesWitnessSha256: choices.ChoicesWitnessSha256! }); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Оновити назви відборів' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Сценарій' }) as HTMLInputElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Проєкт' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Підрозділ' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('combobox', { name: 'Сценарій' }))
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Наш сценарій' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Операційний план')
  expect(readPlannedFlow).toHaveBeenCalledWith(expect.objectContaining({ Scenarios: [scenarioKey], Projects: [], Departments: [], ChoicesWitnessSha256: choices.ChoicesWitnessSha256 }), expect.any(AbortSignal))
})
it('fresh whole-family removal blocks selected generation and preserves old label until explicit reset', async () => {
  vi.clearAllMocks(); const choices = plannedFlowChoices(); vi.mocked(readPlannedFlowChoices).mockResolvedValueOnce(choices)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Оновити назви відборів' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Сценарій' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Сценарій' })); fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Наш сценарій' }))
  const newer = { ...choices, ChoicesWitnessSha256: 'd'.repeat(64), Fields: [{ ...choices.Fields[0], Choices: [] }, ...choices.Fields.slice(1)] }
  vi.mocked(readPlannedFlowChoices).mockResolvedValueOnce(newer)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити назви відборів' }))
  await screen.findByText('Назви або склад значень змінилися. Очистьте відбори й оновіть перелік назв.')
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(readPlannedFlow).not.toHaveBeenCalled(); expect(screen.queryByText(scenarioKey)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Очистити відбори й назви' }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
})
it('caller and scope rotation abort pending name loads and cannot resurrect old choices after ABA', async () => {
  vi.clearAllMocks(); let finish!: (value: PlannedFlowChoices) => void
  vi.mocked(readPlannedFlowChoices).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Оновити назви відборів' }))
  await waitFor(() => expect(readPlannedFlowChoices).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readPlannedFlowChoices).mock.calls[0][1]
  view.rerender(panel('caller2', false)); expect(signal?.aborted).toBe(true)
  view.rerender(panel('caller1', true)); await act(async () => { finish(plannedFlowChoices()) })
  expect((screen.getByRole('combobox', { name: 'Сценарій' }) as HTMLInputElement).disabled).toBe(true)
  expect(readPlannedFlow).not.toHaveBeenCalled()
})
