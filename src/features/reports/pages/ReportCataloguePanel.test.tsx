import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'
import { currentDebtDataset } from '../data/reportDatasets.test-fixtures'
import { ReportCataloguePanel } from './ReportCataloguePanel'

const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: (permission: string) => permission === PermissionKeys.ReportsStocks.Report.Generate && auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', () => ({ getReportCatalogue: vi.fn(), getReportDatasets: vi.fn() }))
const renderPanel = () => render(<MantineProvider env="test"><I18nProvider><ReportCataloguePanel /></I18nProvider></MantineProvider>)
beforeEach(() => {
  vi.clearAllMocks(); auth.allowed = true
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogueFixture())
  vi.mocked(getReportDatasets).mockResolvedValue([currentDebtDataset])
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

it('labels source presentations and separate inventory/native counts without claiming ready complex views', async () => {
  renderPanel()
  expect(await screen.findByText('Типи подання у вихідних конфігураціях 1С; це не перелік готових подань GBA.')).toBeTruthy()
  expect(screen.getByText(/Готові налаштування доступних звітів/)).toBeTruthy()
  expect(screen.getByText('Складне представлення')).toBeTruthy()
  expect(screen.getByText('3 позицій · 4 джерельних реалізацій · 2 вбудованих і регламентованих реалізацій')).toBeTruthy()
  expect(screen.getByText('У GBA доступно 1 наборів даних. Це окремий показник від перенесених звітів.')).toBeTruthy()
  expect(screen.getByText('Повністю перевірені позиції в усіх базах: 0')).toBeTruthy()
  expect(screen.getByText('Fenix: Відповідність підтверджено')).toBeTruthy()
  expect(screen.getByText('AMG: Частково доступно в GBA')).toBeTruthy()
})

it('expands exact source scope, dependencies and different proof kinds without silently applying a mapped dataset', async () => {
  renderPanel(); const button = await screen.findByRole('button', { name: 'Покриття звіту: Борг за договорами' })
  fireEvent.click(button)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByText('Fenix · same-source-id')).toBeTruthy()
  expect(screen.getByText('AMG · same-source-id')).toBeTruthy()
  expect(screen.getByText('Доказ відповідності джерельній реалізації')).toBeTruthy()
  expect(screen.getByText('Перевірка нативного обсягу; повну відповідність 1С не підтверджено')).toBeTruthy()
  expect(screen.getAllByText('Історія взаєморозрахунків ще не перенесена.')).toHaveLength(1)
  expect(screen.getAllByText('Поточна заборгованість [10]')).toHaveLength(2)
  expect(screen.getAllByText('Доступний набір можна вибрати у конструкторі вручну. Каталог не застосовує налаштування й не змінює поточний звіт.')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: /Сформувати|Відкрити набір/ })).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
})

it('filters one implementation while preserving all-world completion and totals', async () => {
  renderPanel(); await screen.findByRole('button', { name: 'Покриття звіту: Борг за договорами' })
  fireEvent.click(screen.getByRole('combobox', { name: 'База' })); fireEvent.click(await screen.findByRole('option', { name: 'AMG' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Стан перенесення' })); fireEvent.click(await screen.findByRole('option', { name: 'Відповідність підтверджено' }))
  expect(screen.getByText('Звітів за цими умовами не знайдено')).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: 'Стан перенесення' })); fireEvent.click(await screen.findByRole('option', { name: 'Частково доступно в GBA' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Стан залежностей' })); fireEvent.click(await screen.findByRole('option', { name: 'Частково покрито' }))
  expect(screen.getByText('У вибірці: 1 позицій · 1 реалізацій. Загальні показники вище охоплюють усі бази.')).toBeTruthy()
  expect(screen.getByText('Повністю перевірені позиції в усіх базах: 0')).toBeTruthy()
  expect(within(screen.getByLabelText('Загальний стан каталогу')).getByText(/3 позицій · 4 джерельних/)).toBeTruthy()
})

it('keeps old catalogue entries unassessed when migration metadata is absent', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue({ ...catalogueFixture(), Migration: undefined })
  renderPanel(); await screen.findByText('Стан перенесення ще не надано сервером. Наявність джерела не підтверджує готовність розрахунку.')
  expect(screen.getAllByRole('button', { name: /^Покриття звіту:/ })).toHaveLength(3)
  expect(screen.queryByText('Fenix: Відповідність підтверджено')).toBeNull()
  expect(screen.getByText(/відповідність підтверджено 0 · не оцінено 4/)).toBeTruthy()
})

it('does not advertise stale mapped availability when actual capabilities fail', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Unavailable'))
  renderPanel(); fireEvent.click(await screen.findByRole('button', { name: 'Покриття звіту: Борг за договорами' }))
  expect(screen.getByText('Доступність наборів GBA не підтверджена: не вдалося завантажити можливості сервера.')).toBeTruthy()
  expect(screen.getAllByText('Набір [10] зараз недоступний або його доступність не підтверджена.')).toHaveLength(2)
  expect(screen.queryByText('Поточна заборгованість [10]')).toBeNull()
})

it('does not request native capabilities or expose mapped availability without generation permission', async () => {
  auth.allowed = false
  renderPanel(); fireEvent.click(await screen.findByRole('button', { name: 'Покриття звіту: Борг за договорами' }))
  expect(getReportDatasets).not.toHaveBeenCalled()
  expect(screen.getAllByText('Для роботи з наборами GBA потрібне право формування звітів.')).toHaveLength(2)
  expect(screen.queryByText('Поточна заборгованість [10]')).toBeNull()
})
