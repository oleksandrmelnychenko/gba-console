import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { netDataset, reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

const productClassification = {
  Version: 1, SourceWorld: 0, ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false,
}
const sourceOrganizations = {
  Version: 1, SourceWorld: 'fenix', OrganizationIds: ['00000000000000000000000000000002', '00000000000000000000000000000001'],
}

function savedTemplate() {
  const data = defaultDatasetRequest(netDataset, '2026-07-01', '2026-07-31')
  return { Id: crypto.randomUUID(), Revision: 4, Name: 'Daily exact', Data: {
    ...data, ProductClassification: structuredClone(productClassification),
    SourceOrganizations: structuredClone(sourceOrganizations),
  } }
}

async function ready() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}

async function applySaved() {
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Daily exact/ }))
}

describe('exact Fenix filters in the report constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })

  it('submits and updates a saved exact scope without exposing an unproved free-text editor', async () => {
    const template = savedTemplate()
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    await applySaved()

    expect(screen.queryByRole('textbox', { name: /Fenix|виду товару|організацій джерела/i })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 2, productClassification, sourceOrganizations,
    })
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('ProductClassification')
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('SourceOrganizations')

    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toMatchObject({ Id: template.Id, Revision: 4, Data: {
      productClassification, sourceOrganizations,
    } })
  })

  it('refuses an invalid exact scope before replacing the current constructor', async () => {
    const template = savedTemplate()
    template.Data.SourceOrganizations = { ...sourceOrganizations, SourceWorld: 'Fenix' }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await ready()
    await applySaved()

    expect(screen.getByText(/Некоректний точний відбір організацій Fenix/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
