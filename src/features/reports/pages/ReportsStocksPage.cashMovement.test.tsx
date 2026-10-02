import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCashMovementCapabilities, previewCashMovement } from '../api/cashMovementApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { cashMovementCapability, cashMovementCatalogueEntry, cashMovementReport } from '../data/cashMovement.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { CashMovementKind } from '../data/cashMovement'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'cash-movement-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/cashMovementApi', () => ({ getCashMovementCapabilities: vi.fn(), previewCashMovement: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
function configure(kind: CashMovementKind) {
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [cashMovementCatalogueEntry(kind)] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getCashMovementCapabilities).mockResolvedValue(cashMovementCapability(kind))
  vi.mocked(previewCashMovement).mockResolvedValue(cashMovementReport(kind))
}
// Keep the UI wait focused on opening/rendering, after Vite has loaded the real lazy module.
// API loading remains deferred and is asserted before the catalogue is opened.
beforeAll(async () => { await import('./ReportCataloguePanel') })
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  configure('receipts'); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
})
it.each(['receipts', 'payouts'] as const)('defers %s capability and uses its own period without changing the native draft', async kind => {
  configure(kind)
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getCashMovementCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value, through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = 'report-workspace-draft:v1:cash-movement-test-owner', draft = sessionStorage.getItem(draftKey)
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: kind === 'receipts' ? 'Відкрити надходження за квартал' : 'Відкрити виплати за місяць' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  const modal = await screen.findByRole('dialog', { name: cashMovementCapability(kind).Title })
  const period = within(modal).getByLabelText(kind === 'receipts' ? 'Квартал' : 'Місяць')
  expect((period as HTMLInputElement).type).toBe(kind === 'receipts' ? 'text' : 'month')
  expect(within(modal).queryByRole('combobox')).toBeNull(); expect(within(modal).queryByLabelText('Від')).toBeNull(); expect(within(modal).queryByLabelText('До')).toBeNull()
  fireEvent.change(period, { target: { value: kind === 'receipts' ? '2026-Q3' : '2026-09' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат руху коштів' })
  expect(previewCashMovement).toHaveBeenCalledWith(cashMovementCapability(kind), kind === 'receipts' ? '2026-Q3' : '2026-09', expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити рух коштів' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: cashMovementCapability(kind).Title })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})
it('opens the original payout form when native numeric datasets are unavailable', async () => {
  configure('payouts'); vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(screen.getAllByText('Native datasets unavailable').length).toBeGreaterThan(0)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getCashMovementCapabilities).not.toHaveBeenCalled()
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити виплати за місяць' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  const modal = await screen.findByRole('dialog', { name: cashMovementCapability('payouts').Title })
  fireEvent.change(within(modal).getByLabelText('Місяць'), { target: { value: '2026-09' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат руху коштів' })
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem('report-workspace-draft:v1:cash-movement-test-owner')).toBeNull()
})
