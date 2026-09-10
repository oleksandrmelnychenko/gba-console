import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets, stockDataset, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { createSalesReportPreset } from '../data/reportPresets'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { ReportsStocksPage } from './ReportsStocksPage'

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
  return render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
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
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
}
const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []),
  Id: '10000000-0000-4000-8000-000000000004', Revision: 4, Name: 'Договори для чернетки' }

describe('constructor draft recovery', () => {
  beforeEach(() => {
    owner = 'draft-owner-a'; allowed = true
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, stockDataset, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([structuredClone(template)])
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Договір 42' }, { Id: 43, Name: 'Договір 43' }])
  })

  it('recovers an unfinished period after remount only on request, without generating or updating a template', async () => {
    const view = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-03' } })
    view.unmount()
    await restored()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-09-03')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('retains unknown advanced data without a saved template while the restored draft is edited', async () => {
    const view = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    view.unmount()
    const key = 'report-workspace-draft:v1:draft-owner-a'
    const candidate = JSON.parse(sessionStorage.getItem(key)!)
    const futureOptions = { Version: 99, Values: ['contract', '9223372036854775807'], Percent: '' }
    candidate.snapshot.data.futureOptions = futureOptions
    sessionStorage.setItem(key, JSON.stringify(candidate))
    await restored()
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-09' } })
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
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    view.unmount()
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ ...template, Revision: 5 }])
    await restored()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-02')
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
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    if (action === 'reset') fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
    else if (action === 'preset') fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    else if (action === 'template') await openTemplate(template.Name)
    else {
      fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
      fireEvent.click(await screen.findByRole('option', { name: stockDataset.Name }))
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Повернути попередні налаштування' }))
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-02')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    expect(screen.getByText(`Відкритий шаблон: ${template.Name}`)).toBeTruthy()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('does not offer another account\'s draft and preserves it for the original owner', async () => {
    const first = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    first.unmount()
    owner = 'draft-owner-b'
    const second = await ready()
    expect(screen.queryByRole('button', { name: 'Відновити чернетку' })).toBeNull()
    second.unmount()
    owner = 'draft-owner-a'
    await restored()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-02')
  })
})
