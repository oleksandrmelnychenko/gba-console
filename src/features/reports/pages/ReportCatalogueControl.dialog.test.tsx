import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'
import { currentDebtDataset } from '../data/reportDatasets.test-fixtures'
import { ReportCatalogueControl } from './ReportCatalogueControl'

const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: (permission: string) =>
  permission === PermissionKeys.ReportsStocks.Report.Generate && auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', () => ({ getReportCatalogue: vi.fn(), getReportDatasets: vi.fn() }))
type Props = ComponentProps<typeof ReportCatalogueControl>
const control = (props: Partial<Props> = {}) => <MantineProvider env="test"><I18nProvider>
  <ReportCatalogueControl enabled presentation="dialog" {...props} />
</I18nProvider></MantineProvider>
function launchCatalogue() {
  const catalogue = catalogueFixture()
  catalogue.Reports[0].Id = 'builtin:ЗадолженностьПоКонтрагентам'
  catalogue.Reports[0].Name = 'ЗадолженностьПоКонтрагентам'
  catalogue.Reports[0].Sources.forEach(source => { source.SourceId = '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3' })
  return catalogue
}
beforeEach(() => {
  vi.clearAllMocks(); auth.allowed = true
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  vi.mocked(getReportDatasets).mockResolvedValue([currentDebtDataset])
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

it('loads only after opening the shared wide dialog, then restores trigger focus on close', async () => {
  render(control())
  const trigger = screen.getByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(trigger.getAttribute('data-variant')).toBe('default')
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getReportCatalogue).not.toHaveBeenCalled()
  trigger.focus(); fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Каталог усіх звітів 1С' })
  await within(dialog).findByText('Каталог звітів 1С', { exact: true })
  expect(document.querySelector('.app-modal.report-catalogue-dialog')).toBeTruthy()
  const signal = vi.mocked(getReportCatalogue).mock.calls[0][0] as AbortSignal
  fireEvent.click(screen.getByRole('button', { name: 'Закрити каталог звітів' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  expect(signal.aborted).toBe(true)
})

it('preserves a rejected choice and closes only after the exact catalogue choice succeeds', async () => {
  const catalogue = launchCatalogue()
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  const onOpen = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
  render(control({ onOpen }))
  const trigger = screen.getByRole('button', { name: 'Каталог усіх звітів 1С' })
  trigger.focus(); fireEvent.click(trigger)
  await screen.findByRole('group', { name: 'Відкрити звіт: Борг за договорами' })
  fireEvent.click(screen.getByRole('combobox', { name: 'База' }))
  fireEvent.click(await screen.findByRole('option', { name: 'AMG' }))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити в конструкторі' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText(/Не вдалося відкрити цей варіант/)).toBeTruthy()
  expect(onOpen).toHaveBeenLastCalledWith({ reportId: catalogue.Reports[0].Id, world: 'amg',
    sourceId: catalogue.Reports[0].Sources[1].SourceId, dataSource: 10 }, catalogue)
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити в конструкторі' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  expect(onOpen).toHaveBeenCalledTimes(2)
})

it('does not load disabled controls and removes an open dialog when catalogue access disappears', async () => {
  const onOpen = vi.fn(() => true)
  const view = render(control({ enabled: false, onOpen }))
  fireEvent.click(screen.getByRole('button'))
  view.rerender(control({ disabled: true, onOpen }))
  fireEvent.click(screen.getByRole('button'))
  expect(getReportCatalogue).not.toHaveBeenCalled()
  view.rerender(control({ onOpen }))
  fireEvent.click(screen.getByRole('button'))
  await screen.findByRole('dialog')
  view.rerender(control({ enabled: false, onOpen }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(onOpen).not.toHaveBeenCalled()
})

it('keeps generation permission and capability guards inside the dialog', async () => {
  auth.allowed = false
  const onOpen = vi.fn(() => true)
  const view = render(control({ onOpen }))
  fireEvent.click(screen.getByRole('button'))
  await screen.findByText('Перевірка доступних наборів GBA потребує права формування звітів.')
  expect(getReportDatasets).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  auth.allowed = true
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Capabilities unavailable'))
  view.rerender(control({ onOpen }))
  await screen.findByText('Доступність наборів GBA не підтверджена: не вдалося завантажити можливості сервера.')
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(onOpen).not.toHaveBeenCalled()
})

it('closes with Escape and returns keyboard focus to the trigger', async () => {
  render(control())
  const trigger = screen.getByRole('button')
  trigger.focus(); fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog')
  fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})
