import fixture from '../data/constructorDatasets.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { datasetGroupings, defaultDatasetRequest } from '../data/reportDatasets'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const dataset = parseReportDatasets(fixture).find(dataset => dataset.DataSource === 2)!
  const data = defaultDatasetRequest(dataset, '2026-11-01', '2026-11-16')
  const groupings = datasetGroupings(dataset)
  data.reportProfile = 'sales'
  data.sorted.Row = [4, 10, 7].map(type => groupings.find(group => group.type === type)!)
  data.sorted.Col = [groupings.find(group => group.type === 2)!]
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'ordering-layout', Revision: 1, Name: 'Сортування продажів', Data: data }])
})
afterEach(cleanup)

async function openOrdering() {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити Звіт по продажам' }))
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Сортування продажів' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додаткові налаштування' }))
  return screen.findByRole('region', { name: 'Сортування значень груп' })
}

it('sizes every sales ordering row from the narrow panel instead of the desktop viewport', async () => {
  const panel = await openOrdering()
  const labels = ['Рядки: Організація', 'Рядки: Група товару', 'Рядки: Назва товару', 'Стовпці: По місяцях']
  for (const label of labels) {
    const input = within(panel).getByRole('combobox', { name: `Сортування — ${label}` })
    expect(input).toHaveProperty('value', 'Звичайний порядок')
    const grid = input.closest('.mantine-SimpleGrid-root')!
    expect(grid.parentElement!.classList.contains('mantine-SimpleGrid-container')).toBe(true)
    const styles = grid.parentElement!.previousElementSibling!.textContent!
    expect(styles).toContain('--sg-cols:1')
    expect(styles).toContain('@container simple-grid (min-width: 36em)')
    expect(styles).not.toContain('@media')
  }
})

it('shows complete selected values and preserves independent row and column ordering', async () => {
  const panel = await openOrdering()
  const choose = async (name: string, option: string) => {
    fireEvent.click(within(panel).getByRole('combobox', { name }))
    fireEvent.click(await screen.findByRole('option', { name: option }))
    await waitFor(() => expect(within(panel).getByRole('combobox', { name })).toHaveProperty('value', option))
  }
  await choose('Сортування — Рядки: Організація', 'За підсумком показника')
  await choose('Напрямок — Рядки: Організація', 'За спаданням')
  await choose('Порожні значення — Рядки: Організація', 'Порожні на початку')
  expect(within(panel).getByRole('combobox', { name: 'Показник сортування — Рядки: Організація' })).not.toHaveProperty('value', '')
  await choose('Сортування — Стовпці: По місяцях', 'За значенням поля')
  expect(within(panel).getByRole('combobox', { name: 'Напрямок — Рядки: Організація' })).toHaveProperty('value', 'За спаданням')
  await choose('Сортування — Рядки: Організація', 'Звичайний порядок')
  expect(within(panel).queryByRole('combobox', { name: 'Напрямок — Рядки: Організація' })).toBeNull()
  expect(within(panel).getByRole('combobox', { name: 'Сортування — Стовпці: По місяцях' })).toHaveProperty('value', 'За значенням поля')
  fireEvent.click(within(panel).getByRole('button', { name: 'Очистити збережене сортування' }))
  expect(within(panel).getByRole('combobox', { name: 'Сортування — Стовпці: По місяцях' })).toHaveProperty('value', 'Звичайний порядок')
})
