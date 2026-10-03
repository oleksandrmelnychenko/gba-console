import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPlannedCashCapabilities, getPlannedCashScenarioChoices, previewPlannedCash } from '../api/plannedCashApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { PLANNED_CASH_TEST_CALLER, plannedCashCapability, plannedCashCatalogueEntry, plannedCashReport, plannedCashCalendarKinds, plannedCashDdsKinds, plannedCashChoices, PLANNED_CASH_TEST_CHOICE } from '../data/plannedCash.test-fixtures'
import { createPlannedCashScenarioChoicesRequest } from '../data/plannedCashScenarioChoices'
import type { PlannedCashKind } from '../data/plannedCash'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: '11111111-1111-1111-1111-111111111111' }, hasPermission: () => true }) }))
vi.mock('../api/plannedCashApi', () => ({ getPlannedCashCapabilities: vi.fn(), previewPlannedCash: vi.fn(), getPlannedCashScenarioChoices: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); saveSession({ userNetUid: PLANNED_CASH_TEST_CALLER, csrfToken: 'planned-cash-workspace' })
  vi.mocked(getPlannedCashScenarioChoices).mockImplementation(async (cap, filters) => ({ ...plannedCashChoices(cap.Kind), ...createPlannedCashScenarioChoicesRequest(cap, filters), Available: false, Choices: [], Code: 'catalogue_not_ready' }))
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets); vi.mocked(getServerReportTemplates).mockResolvedValue([])
})
async function openForm(kind: PlannedCashKind) {
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [plannedCashCatalogueEntry(kind)] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getPlannedCashCapabilities).mockResolvedValue(plannedCashCapability(kind)); vi.mocked(previewPlannedCash).mockResolvedValue(plannedCashReport(kind))
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' }); expect(getPlannedCashCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const draftKey = `report-workspace-draft:v1:${PLANNED_CASH_TEST_CALLER}`, draft = sessionStorage.getItem(draftKey)
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  // A cold catalogue opening loads its lazy module before the capability action exists.
  const button = await screen.findByRole('button', { name: 'Відкрити звіт планування коштів' }, { timeout: 5000 }); await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  return { modal: await screen.findByRole('dialog', { name: plannedCashCapability(kind).ReportName }), draftKey, draft, from }
}
it.each(plannedCashCalendarKinds)('opens %s only on demand and keeps explicit periods outside the native draft', async kind => {
  const { modal, draftKey, draft, from } = await openForm(kind)
  fireEvent.change(within(modal).getByLabelText('Період від'), { target: { value: '2026-09-01' } })
  fireEvent.change(within(modal).getByLabelText('Період до (не включно)'), { target: { value: '2026-10-01' } })
  fireEvent.change(within(modal).getByLabelText('Дата планового залишку'), { target: { value: '2026-10-01' } })
  expect(within(modal).queryByRole('combobox')).toBeNull(); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат планування коштів' }); expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити звіт планування коштів' })); await waitFor(() => expect(screen.queryByRole('dialog', { name: plannedCashCapability(kind).ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect(getPlannedCashCapabilities).toHaveBeenCalledWith(kind, PLANNED_CASH_TEST_CALLER, expect.any(AbortSignal))
})
it.each(plannedCashDdsKinds)('opens %s dates with a real pending scenario notice and never substitutes native payments', async kind => {
  const { modal } = await openForm(kind)
  expect(await within(modal).findByText(/Вибір сценарію плану ще не доступний/)).toBeTruthy(); expect(within(modal).queryByRole('combobox')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Сформувати' })); expect(previewPlannedCash).not.toHaveBeenCalled(); expect(createStockReport).not.toHaveBeenCalled()
})

it.each(plannedCashDdsKinds)('uses genuine %s choices in its own modal without changing the native report draft', async kind => {
  vi.mocked(getPlannedCashScenarioChoices).mockImplementation(async (cap, filters) => ({ ...plannedCashChoices(cap.Kind), ...createPlannedCashScenarioChoicesRequest(cap, filters) }))
  const { modal, draftKey, draft } = await openForm(kind)
  for (const [label, value] of [['Період від', '2026-09-01'], ['Період до (не включно)', '2026-10-01'], ['Попередній період від', '2026-08-01'], ['Попередній період до (не включно)', '2026-09-01']]) {
    fireEvent.change(within(modal).getByLabelText(label), { target: { value } })
  }
  const combo = await within(modal).findByRole('combobox', { name: 'Сценарій плану' })
  fireEvent.change(combo, { target: { value: PLANNED_CASH_TEST_CHOICE } }); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат планування коштів' })
  expect(vi.mocked(previewPlannedCash).mock.calls[0][4]).toBe(PLANNED_CASH_TEST_CHOICE)
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
})
