import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { agreementPricesDataset, agreementPricesRequest } from '../data/agreementPrices.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'prices-owner' }, hasPermission: () => allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened }: { opened: boolean }) => opened ? <div role="dialog" aria-label="Файли звіту" /> : null,
}))
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
async function ready() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
async function prices() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: agreementPricesDataset.Name }))
}
async function agreement() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Договір для звіту цін' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Клієнт · Договір [42]' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
}
beforeEach(() => {
  allowed = true; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, agreementPricesDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Клієнт · Договір [42]' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/prices.xlsx' }, raw: {} })
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
})
it('requires a verified exact contract, keeps it in the preset and submits current prices without dates', async () => {
  const view = await ready(); await prices()
  expect(screen.queryByLabelText('Від')).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(view.container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
  await agreement()
  fireEvent.click(screen.getByRole('button', { name: 'Ціни товарів за договором' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 22, valuationClientAgreementId: 42,
    from: '', to: '', sorted: { Row: [{ type: 5 }, { type: 28 }], Col: [], Measurements: [{ Type: 63 }] } })
  expect(searchValuationAgreements).toHaveBeenCalledWith({ value: '42', limit: 30, offset: 0 }, expect.any(AbortSignal))
})
it('retains contract and price layout in a saved template and rejects unavailable contract at generation', async () => {
  const template = { Id: '10000000-0000-4000-8000-000000000022', Revision: 1, Name: 'Мої ціни', Data: agreementPricesRequest() }
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Мої ціни/ }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Договір для звіту цін' }) as HTMLInputElement).value).toContain('[42]')
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toMatchObject(template.Data)
  allowed = false; view.rerender(<Providers><ReportsStocksPage /></Providers>)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
})
it('restores the price draft and exact contract after remount without generating or saving', async () => {
  const view = await ready(); await prices(); await agreement()
  view.unmount()
  render(<Providers><ReportsStocksPage /></Providers>)
  const restore = await screen.findByRole('button', { name: 'Відновити чернетку' })
  await waitFor(() => expect((restore as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(restore)
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Договір для звіту цін' }) as HTMLInputElement).value).toContain('[42]'))
  expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
})
