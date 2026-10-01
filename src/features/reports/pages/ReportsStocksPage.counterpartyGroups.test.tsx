import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getSettlementCounterpartyGroups } from '../api/counterpartyGroupsApi'
import { groupDataset, groupId } from '../data/sourceCounterpartyGroups.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/counterpartyGroupsApi', () => ({ getSettlementCounterpartyGroups: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getSettlementCounterpartyGroups).mockResolvedValue([{ Id: groupId(1), Name: 'Покупці Київ' }, { Id: groupId(2), Name: 'Виключені покупці' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/groups.xlsx', PdfDocumentURL: '/files/groups.pdf' }, raw: {} })
})

it('selects independent current inclusion/exclusion groups, invalidates old files and clears Fenix groups when AMG is selected', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: groupDataset.Name }))
  await waitFor(() => expect(getSettlementCounterpartyGroups).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('combobox', { name: 'Включити групи контрагентів (Fenix)' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Покупці Київ' }))
  fireEvent.submit(container.querySelector('form')!)
  await screen.findByRole('dialog')
  expect(vi.mocked(createStockReport).mock.calls[0][0].sourceCounterpartyGroups).toEqual({ Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [groupId(1)], ExcludeGroupIds: [] })
  fireEvent.click(screen.getByRole('combobox', { name: 'Виключити групи контрагентів (Fenix)' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Виключені покупці' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0].sourceCounterpartyGroups).toEqual({ Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [groupId(1)], ExcludeGroupIds: [groupId(2)] })
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('combobox', { name: 'База взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Включити групи контрагентів (Fenix)' })).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
  expect(vi.mocked(createStockReport).mock.calls[2][0]).not.toHaveProperty('sourceCounterpartyGroups')
  expect(vi.mocked(createStockReport).mock.calls[2][0]).not.toHaveProperty('sourceBuyerSubtree')
})
