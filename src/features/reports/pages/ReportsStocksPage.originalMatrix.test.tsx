import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalMatrixCapability, getOriginalMatrixScopeBinding, readScopedOriginalMatrix } from '../api/originalVparivanieApi'
import { createStockReport, previewStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { matrixCapability } from '../testing/originalVparivanieFixtures'
import { originalScopeBinding, originalScopeWireTemplate, scopedMatrixFixture } from '../testing/originalVparivanieScopeFixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('./ReportCatalogueControl', () => ({ ReportCatalogueControl: () => null }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), previewStockReport: vi.fn() }))
vi.mock('../api/originalVparivanieApi', () => ({ getOriginalMatrixCapability: vi.fn(), getOriginalMatrixScopeBinding: vi.fn(), readScopedOriginalMatrix: vi.fn() }))
const dataset = { ...currentVparivanieDataset, currentVparivanie: { ...currentVparivanieDataset.currentVparivanie as object,
  FullScopeVersion: 1, FullScopeContract: 'OneOurSnapshotCompleteSelectedScope', FullScopeMaximumRows: 500000,
  FullScopeMaximumSelectedProducts: 4096, FullScopeMaximumColumns: 256, FullScopeMaximumAddressedCells: 1000000 } }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([normalizeSavedTemplate(originalScopeWireTemplate())])
  vi.mocked(getOriginalMatrixCapability).mockResolvedValue(matrixCapability())
  vi.mocked(getOriginalMatrixScopeBinding).mockResolvedValue(originalScopeBinding())
  vi.mocked(readScopedOriginalMatrix).mockResolvedValue(scopedMatrixFixture())
})
it('opens the exact full-period saved form and runs its mounted original matrix without a current-report fallback', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Відкрити для редагування: Оригінальна повна матриця/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2025-01-01')
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-10-09')
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  await waitFor(() => expect(readScopedOriginalMatrix).toHaveBeenCalledOnce())
  expect(getOriginalMatrixScopeBinding).toHaveBeenCalledWith(matrixCapability(),
    { World: 'fenix', From: '2025-01-01', Through: '2026-10-09', GroupId: 3569 }, expect.any(AbortSignal))
  expect(screen.getByRole('table')).toBeTruthy()
  fireEvent.submit(container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled(); expect(previewStockReport).not.toHaveBeenCalled()
})
