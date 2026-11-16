import fixture from '../data/constructorDatasets.dev-fixture.json'
import measurements from '../data/salesMeasurements.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

async function openMeasures(profile: 'sales' | 'grossProfit') {
  const dataset = parseReportDatasets(fixture.map(item => item.DataSource === 2 ? { ...item, Measurements: measurements } : item)).find(item => item.DataSource === 2)!
  const data = defaultDatasetRequest(dataset, '2026-11-01', '2026-11-16')
  data.reportProfile = profile
  data.sorted.Measurements = [14, 15, 115].map(type => ({ ...dataset.Measurements.find(item => item.Type === type)!, IsChecked: true, parentName: '' }))
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'measure-order', Revision: 1, Name: 'Порядок показників', Data: data }])
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити Звіт по продажам' }))
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Порядок показників' }))
  return screen.getByRole('region', { name: 'Показники' })
}

const order = (panel: HTMLElement) => within(panel).getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))

it.each(['sales', 'grossProfit'] as const)('keeps every %s measure in place when checking and unchecking groups and VAT children', async profile => {
  const panel = await openMeasures(profile)
  const controls = within(panel)
  const before = order(panel)
  expect(before).toHaveLength(profile === 'sales' ? 19 : 17)
  expect(controls.getByRole('checkbox', { name: 'Націнка, %' })).toHaveProperty('checked', true)
  expect(controls.getByRole('checkbox', { name: 'Маржа, %' })).toHaveProperty('indeterminate', true)
  const tree = controls.getByRole('list', { name: 'Показники' })
  tree.scrollTop = 200
  for (const name of ['Націнка, %', ...(profile === 'sales' ? ['Націнка, %, з ПДВ', 'Маржа, %, з ПДВ', 'Собівартість'] : ['Націнка з ПДВ, %', 'Маржа з ПДВ, %', 'Собівартість (EUR)'])]) {
    const checkbox = controls.getByRole('checkbox', { name }) as HTMLInputElement
    const checked = checkbox.checked
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(!checked)
    expect(order(panel)).toEqual(before)
    expect(tree.scrollTop).toBe(200)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(checked)
    expect(order(panel)).toEqual(before)
  }
  fireEvent.click(controls.getByRole('button', { name: 'Очистити вибір показників' }))
  expect(order(panel)).toEqual(before)
  expect(controls.getAllByRole('checkbox').every(item => !(item as HTMLInputElement).checked)).toBe(true)
  fireEvent.click(controls.getByRole('button', { name: 'Вибрати всі показники' }))
  expect(order(panel)).toEqual(before)
  expect(controls.getAllByRole('checkbox').every(item => (item as HTMLInputElement).checked)).toBe(true)
})

it.each(['sales', 'grossProfit'] as const)('retains explicit %s ordering of unchecked rows and serializes only selected identities', async profile => {
  const panel = await openMeasures(profile)
  const withVat = profile === 'sales' ? 'Маржа, %, з ПДВ' : 'Маржа з ПДВ, %'
  const withoutVat = profile === 'sales' ? 'Маржа, %, без ПДВ' : 'Маржа без ПДВ, %'
  const controls = within(panel)
  fireEvent.click(controls.getByRole('button', { name: 'Упорядкувати всі показники від А до Я' }))
  const alphabetic = order(panel)
  const groupOrder = [...panel.querySelectorAll('.constructor-measures > ul > li > .constructor-tree-row input')].map(item => item.getAttribute('aria-label'))
  expect(groupOrder).toEqual(profile === 'sales'
    ? ['Валовий прибуток', 'Вартість продажу', 'Кількість продажу', 'Маржа, %', 'Націнка, %', 'Собівартість']
    : ['Валовий прибуток (EUR)', 'Вартість продажу (EUR)', 'Кількість (од. зберігання)', 'Маржа, %', 'Націнка, %', 'Собівартість (EUR)'])
  fireEvent.click(controls.getByRole('button', { name: 'Очистити вибір показників' }))
  expect(order(panel)).toEqual(alphabetic)
  fireEvent.click(controls.getByRole('checkbox', { name: 'Націнка, %' }))
  fireEvent.click(controls.getByRole('checkbox', { name: withoutVat }))
  expect(order(panel)).toEqual(alphabetic)
  fireEvent.click(controls.getByRole('button', { name: withVat }))
  fireEvent.click(controls.getByRole('button', { name: `Перемістити ${withVat} вище` }))
  const moved = order(panel)
  expect(moved).not.toEqual(alphabetic)
  expect(moved.indexOf(withVat)).toBeLessThan(moved.indexOf(withoutVat))
  fireEvent.click(controls.getByRole('checkbox', { name: withVat }))
  expect(order(panel)).toEqual(moved)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const selected = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.sorted.Measurements
  expect(selected.map(item => item.Type)).toEqual([116, 115, 14, 15])
  expect(selected.every(item => item.IsChecked)).toBe(true)
})
