import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { reportDatasets, stockDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []), Id: crypto.randomUUID(), Revision: 4, Name: 'Збережені договори' }
async function openTemplate() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Збережені договори/ })) }

describe('constructor opened-template identity', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, stockDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 5 }))
  })
  it.each(['reset', 'preset', 'dataset'])('clears the opened target after %s without overwriting its stored settings', async action => {
    render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Продажі за днями' }); await openTemplate()
    if (action === 'reset') fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
    else if (action === 'preset') fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    else { fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' })); fireEvent.click(await screen.findByRole('option', { name: stockDataset.Name })) }
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    expect(screen.queryByRole('button', { name: 'Оновити шаблон' })).toBeNull()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
  it('sends an edited period only to the opened id while preserving its stored name', async () => {
    render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Продажі за днями' }); await openTemplate()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.change(screen.getByLabelText('Назва шаблону'), { target: { value: 'Назва нового draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toMatchObject({ Id: template.Id, Revision: 4, Name: template.Name, Data: { from: '2026-09-02', to: template.Data.to } })
  })
  it('does not upgrade an old opened draft when renaming a newer reloaded template', async () => {
    render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Продажі за днями' }); await openTemplate()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-02' } })
    const newer = { ...template, Revision: 5, Data: { ...template.Data, from: '2026-09-03' } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([newer])
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 6 }))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Оновити шаблон' }) as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(within(screen.getByRole('group', { name: template.Name })).getByRole('button', { name: 'Перейменувати' }))
    fireEvent.change(screen.getByLabelText('Нова назва'), { target: { value: 'Нова назва договорів' } })
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await screen.findByRole('group', { name: 'Нова назва договорів' })
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toMatchObject({ Revision: 5, Data: newer.Data })
    expect((screen.getByRole('button', { name: 'Оновити шаблон' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    expect(saveServerReportTemplate).toHaveBeenCalledOnce()
  })

})
