import { currencyDataset, currencySelection } from '../data/reportPresentationCurrency.test-fixtures'
import { getReportPresentationCurrencies } from '../api/reportPresentationCurrencies'
import { changeReportPeriod, readReportDateInput } from '../testing/reportPeriod'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets, stockDataset, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { createSalesReportPreset } from '../data/reportPresets'
import { datasetGroupings, datasetMeasurements, defaultDatasetRequest } from '../data/reportDatasets'
import { documentDataset, documentRequest } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { productTimeDataset } from '../data/currentFinancialProductTimeAxes.test-fixtures'
import { encodeReportWorkspaceDraft, reportWorkspaceDraftKey } from '../data/reportWorkspaceDraft'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../api/reportPresentationCurrencies', () => ({ getReportPresentationCurrencies: vi.fn() }))

let owner = 'draft-owner-a'
let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: owner }, hasPermission: () => allowed }) }))
vi.mock('./ReportCatalogueControl', () => ({ ReportCatalogueControl: () => null }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
}))

function workspace() {
  return render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
}
async function ready() {
  const view = workspace()
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
async function restored() {
  const view = workspace()
  const restore = await screen.findByRole('button', { name: 'Відновити чернетку' })
  await waitFor(() => expect((restore as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(restore)
  return view
}
async function openTemplate(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити для редагування: ${name}` }))
}
const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []),
  Id: '10000000-0000-4000-8000-000000000004', Revision: 4, Name: 'Договори для чернетки' }

describe('constructor draft recovery', () => {
  beforeEach(() => {
    owner = 'draft-owner-a'; allowed = true
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
    vi.mocked(getReportPresentationCurrencies).mockResolvedValue([{ value: currencySelection.currencyNetUid, code: 'UAH', label: 'UAH — Гривня' }])
    saveSession({ userNetUid: owner, csrfToken: 'draft-fixture-csrf-a' })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, stockDataset, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([structuredClone(template)])
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Договір 42' }, { Id: 43, Name: 'Договір 43' }])
  })
  afterEach(clearSession)

  function stageFinancial(rows: number[], columns: number[], mode = 0, currency = false) {
    const data = { ...documentRequest(rows, columns), profitReadMode: mode, ...(currency ? { presentationCurrency: currencySelection } : {}) }
    const fields = datasetGroupings(documentDataset, { ...data, profitReadMode: 0 })
    data.sorted.Row = rows.map(type => fields.find(field => field.type === type)!)
    data.sorted.Col = columns.map(type => fields.find(field => field.type === type)!)
    const measurements = datasetMeasurements(documentDataset, documentDataset.Measurements.map(field => ({ ...field, IsChecked: true, parentName: '' })))
    data.sorted.Measurements = measurements.flatMap(group => group.SubList.map(field => ({ ...field, parentName: group.Name })))
    const encoded = encodeReportWorkspaceDraft({ version: 1, ownerId: owner, savedAt: new Date().toISOString(),
      snapshot: { name: 'Фінансова чернетка', data, measurements, activeTemplate: null, previousPeriod: { from: data.from, to: data.to } } })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) throw new Error('Invalid test draft')
    sessionStorage.setItem(reportWorkspaceDraftKey(owner), encoded.value)
    return { data, raw: encoded.value }
  }

  it('restores report currency through workspace, keeps it across date edits and a second recovery', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currencyDataset])
    const { data } = stageFinancial([81], [5], 0, true)
    const view = await restored()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Відновити чернетку' })).toBeNull())
    changeReportPeriod({ from: '2026-10-18' })
    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem(reportWorkspaceDraftKey(owner))!)
      expect(stored.snapshot.data.presentationCurrency).toEqual(currencySelection)
      expect(stored.snapshot.data.from).toBe('2026-10-18')
      expect(stored.snapshot.data.sorted).toEqual(data.sorted)
      expect(stored.snapshot.data.selections).toEqual(data.selections)
    })
    view.unmount()
    await restored()
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe('2026-10-18')
    const currency = await screen.findByRole('combobox', { name: 'Валюта звіту' })
    fireEvent.click(currency)
    fireEvent.click(screen.getByRole('option', { name: 'EUR — за замовчуванням' }))
    await waitFor(() => {
      const cleared = JSON.parse(sessionStorage.getItem(reportWorkspaceDraftKey(owner))!)
      expect(cleared.snapshot.data).not.toHaveProperty('presentationCurrency')
      expect(cleared.snapshot.data).not.toHaveProperty('PresentationCurrency')
      expect(cleared.snapshot.data.sorted).toEqual(data.sorted)
      expect(cleared.snapshot.data.selections).toEqual(data.selections)
    })
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it.each(['old-metadata', 'unsupported-mode'])('refuses a currency draft on %s without dropping it', async reason => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, reason === 'old-metadata' ? documentDataset : currencyDataset])
    const { raw } = stageFinancial([3], [4], reason === 'unsupported-mode' ? 1 : 0, true)
    await restored()
    await screen.findByText(reason === 'old-metadata' ? /Сервер не підтвердив вибір валюти/ : /Валюта звіту доступна лише/)
    expect(sessionStorage.getItem(reportWorkspaceDraftKey(owner))).toBe(raw)
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it.each([[[81], [5]], [[5], [81]], [[0], [2]], [[12], [15]]])('restores stored financial axes %j / %j through the real workspace action', async (rows, columns) => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, documentDataset])
    const { data } = stageFinancial(rows, columns)
    await restored()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Відновити чернетку' })).toBeNull())
    for (const field of [...data.sorted.Row, ...data.sorted.Col]) expect(screen.getByRole('button', { name: `Видалити ${field.label}` })).toBeTruthy()
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe(data.from)
    expect((readReportDateInput('До') as HTMLInputElement).value).toBe(data.to)
    changeReportPeriod({ from: '2026-10-18' })
    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem(reportWorkspaceDraftKey(owner))!)
      expect(stored.snapshot.data.from).toBe('2026-10-18')
      expect(stored.snapshot.data.to).toBe(data.to)
      expect(stored.snapshot.data.sorted).toEqual(data.sorted)
      expect(stored.snapshot.data.selections).toEqual(data.selections)
    })
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it.each(['missing-capability', 'unsupported-mode'])('refuses a stored document draft on %s without rewriting it', async reason => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, reason === 'missing-capability' ? productTimeDataset : documentDataset])
    const { raw } = stageFinancial([81], [5], reason === 'unsupported-mode' ? 1 : 0)
    await restored()
    await screen.findByText(reason === 'missing-capability' ? /сервер не підтвердив/ : /Групування за документом/)
    expect(sessionStorage.getItem(reportWorkspaceDraftKey(owner))).toBe(raw)
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('recovers an unfinished period after remount only on request, without generating or updating a template', async () => {
    const view = await ready()
    changeReportPeriod({ from: '', to: '2026-09-03' })
    view.unmount()
    await restored()
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe('')
    expect((readReportDateInput('До') as HTMLInputElement).value).toBe('2026-09-03')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('retains unknown advanced data without a saved template while the restored draft is edited', async () => {
    const view = await ready()
    changeReportPeriod({ from: '2026-09-02' })
    view.unmount()
    const key = 'report-workspace-draft:v1:draft-owner-a'
    const candidate = JSON.parse(sessionStorage.getItem(key)!)
    const futureOptions = { Version: 99, Values: ['contract', '9223372036854775807'], Percent: '' }
    candidate.snapshot.data.futureOptions = futureOptions
    sessionStorage.setItem(key, JSON.stringify(candidate))
    await restored()
    changeReportPeriod({ to: '2026-09-09' })
    await waitFor(() => {
      const saved = JSON.parse(sessionStorage.getItem(key)!)
      expect(saved.snapshot.data.to).toBe('2026-09-09')
      expect(saved.snapshot.data.futureOptions).toEqual(futureOptions)
      expect(saved.snapshot.activeTemplate).toBeNull()
    })
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('restores the opened revision without adopting a newer server revision', async () => {
    const view = await ready(); await openTemplate(template.Name)
    changeReportPeriod({ from: '2026-09-02' })
    view.unmount()
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ ...template, Revision: 5 }])
    await restored()
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe('2026-09-02')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Оновити шаблон' }) as HTMLButtonElement).disabled).toBe(true))
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('recovers the exact edited valuation agreement and its disabled contract selection', async () => {
    const valuationTemplate = { Id: template.Id, Revision: 4, Name: 'Оцінка для чернетки', Data: {
      ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 42,
      selections: [{ IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
        FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Name: 'Інший договір', Value: 41, Data: { Id: 41 } }] }],
    } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([valuationTemplate])
    const view = await ready(); await openTemplate(valuationTemplate.Name)
    fireEvent.click(screen.getByRole('combobox', { name: 'Договір для оцінки' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір 43' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    view.unmount()
    await restored()
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Договір для оцінки' }) as HTMLInputElement).value).toBe('Договір 43'))
    const stored = JSON.parse(sessionStorage.getItem('report-workspace-draft:v1:draft-owner-a')!)
    expect(stored.snapshot.data.valuationClientAgreementId).toBe(43)
    expect(stored.snapshot.data.selections).toEqual(valuationTemplate.Data.selections)
    expect(stored.snapshot.activeTemplate).toMatchObject({ Id: template.Id, Revision: 4, Data: { valuationClientAgreementId: 42 } })
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it.each(['reset', 'preset', 'dataset', 'template'])('can return to the previous exact draft after %s', async action => {
    await ready(); await openTemplate(template.Name)
    changeReportPeriod({ from: '2026-09-02' })
    if (action === 'reset') fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
    else if (action === 'preset') fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    else if (action === 'template') await openTemplate(template.Name)
    else {
      fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
      fireEvent.click(await screen.findByRole('option', { name: stockDataset.Name }))
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Повернути попередні налаштування' }))
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe('2026-09-02')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    expect(within(screen.getByText('Відкритий шаблон').parentElement!).getByText(template.Name)).toBeTruthy()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('does not offer another account\'s draft and preserves it for the original owner', async () => {
    const first = await ready()
    changeReportPeriod({ from: '2026-09-02' })
    first.unmount()
    owner = 'draft-owner-b'
    saveSession({ userNetUid: owner, csrfToken: 'draft-fixture-csrf-b' })
    const second = await ready()
    expect(screen.queryByRole('button', { name: 'Відновити чернетку' })).toBeNull()
    second.unmount()
    owner = 'draft-owner-a'
    saveSession({ userNetUid: owner, csrfToken: 'draft-fixture-csrf-a-returned' })
    await restored()
    expect((readReportDateInput('Від') as HTMLInputElement).value).toBe('2026-09-02')
  })
})
