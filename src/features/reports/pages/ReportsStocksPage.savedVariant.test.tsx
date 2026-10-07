import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, previewStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { previewSavedNativeReport } from '../api/savedNativeReportApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

const caller = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true,
  session: { userNetUid: 'caller-a', csrfToken: 'csrf-a' } }) }))
vi.mock('./ReportCatalogueControl', () => ({ ReportCatalogueControl: () => null }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), previewStockReport: vi.fn(),
}))
vi.mock('../api/savedNativeReportApi', async original => ({ ...await original<typeof import('../api/savedNativeReportApi')>(),
  previewSavedNativeReport: vi.fn(), generateSavedNativeReport: vi.fn(),
}))
const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []),
  Id: '11111111-1111-1111-1111-111111111111', Revision: 4, Name: 'Збережені договори' }
async function ready() {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити для редагування: ${template.Name}` }))
}

describe('saved variant and dirty constructor draft are explicit independent actions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); saveSession(caller)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([structuredClone(template)])
    vi.mocked(previewSavedNativeReport).mockResolvedValue({ binding: { id: template.Id, revision: 4, definitionSha256: 'a'.repeat(64) },
      result: { document: { DocumentURL: '/files/saved.xlsx', PdfDocumentURL: '/files/saved.pdf' }, raw: {} } })
    vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
      Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true, Request: null,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
      RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
    } })
  })
  afterEach(() => clearSession())

  it('runs the exact saved revision while the edited period and draft name remain unsaved', async () => {
    await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.change(screen.getByLabelText('Назва шаблону'), { target: { value: 'Моя незбережена чернетка' } })
    fireEvent.click(within(screen.getByRole('group', { name: template.Name })).getByRole('button', { name: 'Збережений варіант' }))
    fireEvent.click(screen.getByRole('button', { name: 'Показати збережений варіант' }))
    await screen.findByRole('button', { name: 'Файли збереженого звіту' })
    expect(vi.mocked(previewSavedNativeReport).mock.calls[0][0]).toEqual({ id: template.Id, revision: 4, dataSource: 0 })
    expect((screen.getByLabelText('Назва шаблону') as HTMLInputElement).value).toBe('Моя незбережена чернетка')
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-02')
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    expect(createStockReport).not.toHaveBeenCalled(); expect(previewStockReport).not.toHaveBeenCalled()
    expect(template.Data.from).toBe('2026-09-01')
    fireEvent.click(screen.getByRole('button', { name: 'Закрити перегляд варіанта' }))
    expect(screen.queryByRole('button', { name: 'Файли збереженого звіту' })).toBeNull()
    fireEvent.click(within(screen.getByRole('group', { name: template.Name })).getByRole('button', { name: `Відкрити для редагування: ${template.Name}` }))
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-01')
  })

  it('uses an edited draft only when the ordinary constructor preview is explicitly requested', async () => {
    await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
    await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ from: '2026-09-02', to: template.Data.to })
    expect(previewSavedNativeReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
