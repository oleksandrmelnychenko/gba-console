import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { findOpenedWorkbook, openWorkbookSettingsSection } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: null }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const publishedMeasurements = [
  {
    "Type": 2,
    "Name": "Продажі без ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 3,
    "Name": "ПДВ продажів, EUR",
    "Selectable": true
  },
  {
    "Type": 4,
    "Name": "Продажі з ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 6,
    "Name": "Собівартість без ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 7,
    "Name": "ПДВ собівартості, EUR",
    "Selectable": true
  },
  {
    "Type": 8,
    "Name": "Собівартість з ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 10,
    "Name": "Валовий прибуток без ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 12,
    "Name": "Валовий прибуток з ПДВ, EUR",
    "Selectable": true
  },
  {
    "Type": 14,
    "Name": "Рентабельність без ПДВ, %",
    "Selectable": true
  },
  {
    "Type": 15,
    "Name": "Рентабельність з ПДВ, %",
    "Selectable": true
  }
]

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...profitDayDataset, Measurements: publishedMeasurements }])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

async function openMeasures() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  openWorkbookSettingsSection('Показники')
  return { ...view, panel: screen.getByRole('group', { name: 'Показники' }) }
}

it('labels VAT choices inside each tile and omits unsupported variants', async () => {
  const { panel } = await openMeasures()
  const tiles = [...panel.querySelectorAll('.reports-stocks-legacy-measurement')]
  expect(tiles).toHaveLength(4)
  for (const [index, tile] of tiles.entries()) {
    const options = tile.querySelector('.reports-stocks-measurement-options')!
    expect(within(options as HTMLElement).getByText('Без ПДВ')).toBeTruthy()
    expect(within(options as HTMLElement).getByText('З ПДВ')).toBeTruthy()
    expect(within(options as HTMLElement).queryByText('ПДВ') !== null).toBe(index < 2)
  }
  expect(panel.querySelectorAll('.reports-stocks-measurement-value input[type="checkbox"]')).toHaveLength(10)
})

it('preserves all ten published measures and individual, group, all and clear selection', async () => {
  const { panel } = await openMeasures()
  const controls = within(panel)
  const inputs = publishedMeasurements.map(measure => controls.getByRole('checkbox', { name: measure.Name }) as HTMLInputElement)
  expect(inputs).toHaveLength(10)
  fireEvent.click(controls.getByRole('button', { name: 'Очистити' }))
  expect(inputs.every(input => !input.checked)).toBe(true)
  fireEvent.click(inputs[2])
  expect(inputs.filter(input => input.checked)).toEqual([inputs[2]])
  const row = inputs[2].closest('.reports-stocks-legacy-measurement')!
  const group = row.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  expect(group.indeterminate).toBe(true)
  fireEvent.click(group)
  expect(inputs.slice(0, 3).every(input => input.checked)).toBe(true)
  expect(inputs.slice(3).every(input => !input.checked)).toBe(true)
  fireEvent.click(controls.getByRole('button', { name: 'Усі' }))
  expect(inputs.every(input => input.checked)).toBe(true)
  fireEvent.click(controls.getByRole('button', { name: 'Очистити' }))
  expect(inputs.every(input => !input.checked)).toBe(true)
})
