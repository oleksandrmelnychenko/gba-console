import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'
import { currentDebtDataset, placementDataset, stockDataset } from '../data/reportDatasets.test-fixtures'
import { ReportCataloguePanel } from './ReportCataloguePanel'
import { ReportCatalogueControl } from './ReportCatalogueControl'
import type { ReportCatalogue, ReportDataset } from '../types'

const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: (permission: string) => permission === PermissionKeys.ReportsStocks.Report.Generate && auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', () => ({ getReportCatalogue: vi.fn(), getReportDatasets: vi.fn() }))
const panel = (props: ComponentProps<typeof ReportCataloguePanel> = {}) => <MantineProvider env="test"><I18nProvider><ReportCataloguePanel {...props} /></I18nProvider></MantineProvider>
const renderPanel = (props: ComponentProps<typeof ReportCataloguePanel> = {}) => render(panel(props))
const openSpy = () => vi.fn<NonNullable<ComponentProps<typeof ReportCataloguePanel>['onOpen']>>(() => true)
const control = (props: ComponentProps<typeof ReportCatalogueControl>) => <MantineProvider env="test"><I18nProvider><ReportCatalogueControl {...props} /></I18nProvider></MantineProvider>
function launchCatalogue(): ReportCatalogue {
  const catalogue = catalogueFixture()
  catalogue.Reports[0].Id = 'builtin:ЗадолженностьПоКонтрагентам'
  catalogue.Reports[0].Name = 'ЗадолженностьПоКонтрагентам'
  catalogue.Reports[0].Sources.forEach(source => { source.SourceId = '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3' })
  return catalogue
}
async function filterWorld(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'База' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}
async function launchReady() {
  return screen.findByRole('group', { name: 'Відкрити звіт: Борг за договорами' })
}
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

it('requires an explicit world choice and passes the exact catalogue without generating a report', async () => {
  const catalogue = launchCatalogue(), onOpen = openSpy()
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  renderPanel({ onOpen })
  const actions = await launchReady()
  const open = within(actions).getByRole('button', { name: 'Відкрити в конструкторі' })
  expect((open as HTMLButtonElement).disabled).toBe(true)
  expect(onOpen).not.toHaveBeenCalled()
  fireEvent.click(within(actions).getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: /^AMG ·/ }))
  fireEvent.click(open)
  expect(onOpen).toHaveBeenCalledExactlyOnceWith({ reportId: catalogue.Reports[0].Id, world: 'amg',
    sourceId: catalogue.Reports[0].Sources[1].SourceId, dataSource: 10 }, catalogue)
  expect(screen.getByText(/звіт сформується лише після натискання/)).toBeTruthy()
  expect(screen.getByText('Варіанти Fenix/AMG позначають походження звіту; розрахунок використовує доступні дані GBA.')).toBeTruthy()
})

it('opens only the filtered exact world and never keeps a prior hidden world choice', async () => {
  const catalogue = launchCatalogue(), onOpen = openSpy()
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  renderPanel({ onOpen })
  const actions = await launchReady()
  fireEvent.click(within(actions).getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: /^AMG ·/ }))
  await filterWorld('Fenix')
  expect(within(await launchReady()).queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити в конструкторі' }))
  expect(onOpen.mock.calls[0][0]).toMatchObject({ world: 'fenix', sourceId: catalogue.Reports[0].Sources[0].SourceId })
  expect(screen.getByText('AMG: Частково доступно в GBA')).toBeTruthy()
  expect(within(screen.getByLabelText('Загальний стан каталогу')).getByText(/3 позицій · 4 джерельних/)).toBeTruthy()
})

it('requires a specific native variant when the same source supports multiple datasets', async () => {
  const catalogue = launchCatalogue(), report = catalogue.Reports[0], onOpen = openSpy()
  report.Id = 'builtin:ОтчетПоМестамХраненияНоменклатуры'
  report.Name = 'ОтчетПоМестамХраненияНоменклатуры'
  report.Title = 'Залишки за місцями зберігання'
  report.Sources.forEach(source => {
    source.SourceId = '9f693421-5a01-40b2-bf49-52d15132d3cb'
    source.Migration!.NativeDataSources = [4, 5]
  })
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getReportDatasets).mockResolvedValue([stockDataset, placementDataset])
  renderPanel({ onOpen })
  await screen.findByRole('group', { name: 'Відкрити звіт: Залишки за місцями зберігання' })
  await filterWorld('AMG')
  const open = screen.getByRole('button', { name: 'Відкрити в конструкторі' })
  expect((open as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('combobox', { name: 'Варіант звіту: Залишки за місцями зберігання' }))
  const variants = await screen.findAllByRole('option')
  expect(variants).toHaveLength(2)
  expect(variants.every(option => option.textContent?.startsWith('AMG ·'))).toBe(true)
  fireEvent.click(variants[1]); fireEvent.click(open)
  expect(onOpen).toHaveBeenCalledExactlyOnceWith({ reportId: report.Id, world: 'amg',
    sourceId: report.Sources[1].SourceId, dataSource: 5 }, catalogue)
})

it('keeps source-only reports searchable and explains their unavailable launch', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  const onOpen = openSpy()
  renderPanel({ onOpen }); await launchReady()
  fireEvent.change(screen.getByLabelText('Пошук звіту'), { target: { value: 'Повернення' } })
  expect(screen.getByRole('button', { name: 'Покриття звіту: Повернення постачальникам' })).toBeTruthy()
  expect(screen.getByText('Для цього звіту ще немає готових налаштувань конструктора.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(onOpen).not.toHaveBeenCalled()
})

it('never launches a generic numeric mapping without a registered named source', async () => {
  const onOpen = openSpy()
  renderPanel({ onOpen }); await screen.findByText('Каталог звітів 1С', { exact: true })
  expect(screen.getAllByRole('button', { name: /^Покриття звіту:/ })).toHaveLength(3)
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(onOpen).not.toHaveBeenCalled()
})

it('blocks launch when migration integrity is invalid while retaining the complete inventory', async () => {
  const catalogue = launchCatalogue()
  catalogue.Migration!.Summary.SourceImplementations = 99
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  renderPanel({ onOpen: openSpy() })
  await screen.findByText(/Дані стану перенесення не узгоджені/)
  expect(screen.getAllByRole('button', { name: /^Покриття звіту:/ })).toHaveLength(3)
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(screen.getAllByText('Готові налаштування не підтверджені: стан перенесення не узгоджений з каталогом.')).toHaveLength(3)
})

it('does not expose launch when server capabilities fail', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Unavailable'))
  renderPanel({ onOpen: openSpy() })
  await screen.findByText('Каталог звітів 1С', { exact: true })
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(screen.getAllByText('Доступність конструктора не підтверджена. Спробуйте відкрити каталог ще раз.')).toHaveLength(3)
})

it('waits for capabilities before exposing launch and ignores a disabled action', async () => {
  let complete!: (datasets: ReportDataset[]) => void
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  vi.mocked(getReportDatasets).mockReturnValue(new Promise(resolve => { complete = resolve }))
  const onOpen = openSpy()
  renderPanel({ onOpen, disabled: true })
  expect(screen.getByText('Завантаження каталогу звітів')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  await act(async () => complete([currentDebtDataset]))
  await launchReady(); await filterWorld('AMG')
  const open = screen.getByRole('button', { name: 'Відкрити в конструкторі' })
  expect((open as HTMLButtonElement).disabled).toBe(true); fireEvent.click(open)
  expect(onOpen).not.toHaveBeenCalled()
})

it('removes launch immediately on permission loss and waits for fresh capabilities when permission returns', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  const onOpen = openSpy(), view = renderPanel({ onOpen })
  await launchReady()
  auth.allowed = false; view.rerender(panel({ onOpen }))
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  await screen.findByText('Перевірка доступних наборів GBA потребує права формування звітів.')
  let complete!: (datasets: ReportDataset[]) => void
  vi.mocked(getReportDatasets).mockReturnValue(new Promise(resolve => { complete = resolve }))
  auth.allowed = true; view.rerender(panel({ onOpen }))
  expect(screen.getByText('Завантаження каталогу звітів')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  await act(async () => complete([]))
  await screen.findByText('Каталог звітів 1С', { exact: true })
  expect(screen.queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  expect(onOpen).not.toHaveBeenCalled()
})

it('retries a failed catalogue load before offering launch', async () => {
  vi.mocked(getReportCatalogue).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(launchCatalogue())
  renderPanel({ onOpen: openSpy() })
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await launchReady()
  expect(getReportCatalogue).toHaveBeenCalledTimes(2)
})

it('keeps the catalogue and selection when the constructor rejects an outdated choice, then closes only on success', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue(launchCatalogue())
  const onOpen = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
  render(control({ enabled: true, onOpen }))
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  await launchReady(); await filterWorld('AMG')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити в конструкторі' }))
  expect(screen.getByRole('button', { name: 'Сховати каталог звітів 1С' })).toBeTruthy()
  expect(screen.getByText(/Не вдалося відкрити цей варіант/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити в конструкторі' }))
  await waitFor(() => expect(screen.queryByText('Каталог звітів 1С', { exact: true })).toBeNull())
  expect(onOpen).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' })).toBeTruthy()
})

it('does not open or load a disabled catalogue control', () => {
  const view = render(control({ enabled: false, onOpen: openSpy() }))
  const toggle = screen.getByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect((toggle as HTMLButtonElement).disabled).toBe(true); fireEvent.click(toggle)
  view.rerender(control({ enabled: true, disabled: true, onOpen: openSpy() }))
  expect((toggle as HTMLButtonElement).disabled).toBe(true); fireEvent.click(toggle)
  expect(getReportCatalogue).not.toHaveBeenCalled()
})
