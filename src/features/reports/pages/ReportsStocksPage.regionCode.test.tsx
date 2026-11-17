import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import catalog from '../data/constructorDatasets.dev-fixture.json'
import type { ReportSelection } from '../types'
import { InlineReportSelection, ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const code = { Id: 903420, NetUid: '51f7c062-f421-4eba-bec1-80072e2568f8', RegionId: 16466, Value: 'BCE00604' }
const buyer = { Id: 635170, Name: 'МАРЧУК Ю. В.  з ПДВ ціни', FullName: 'Марчук Ю. В.  ціни  ПДВ', RegionCodeId: code.Id, RegionCode: code }
const caption = `${code.Value} — ${buyer.Name}`
const secondBuyer = { Id: 633135, Name: 'ЕР СІ ГРЕЙН ТОВ', RegionCodeId: 901653,
  RegionCode: { Id: 901653, NetUid: 'ba93333e-77bf-445d-bee6-4fb2cdec3f0e', RegionId: 16466, Value: 'BCE00605' } }
const field = { Type: 8, Name: 'Код по регіону' }

function Form({ condition = 2, source = 0 }: { condition?: number; source?: number }) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true, SelectedField: field,
    FilterCondition: { Type: condition, Name: condition === 2 ? 'В списку' : 'Рівне' }, Values: [] })
  return <MantineProvider env="test"><I18nProvider>
    <InlineReportSelection dataSource={source} from="2026-11-01" to="2026-11-16" selection={selection}
      selections={[selection]} index={0} variant="row" filterFieldOptions={[{ field, label: field.Name, value: '8' }]}
      onChange={change => { if ('selection' in change) setSelection(change.selection) }} />
    <output data-testid="selection">{JSON.stringify(selection)}</output>
  </I18nProvider></MantineProvider>
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(catalog))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(async (path, options) => path === '/regions/all/codes'
    ? [{ Id: 16466, Name: 'CE', RegionCodes: [code] }]
    : path === '/clients/reports/stocks/search' ? options?.query?.value === 'BCE00605' ? [secondBuyer]
      : [buyer, { Id: 635301, Name: 'Марчук Олена Людвиківна ФОП', RegionCodeId: null, RegionCode: null }] : [])
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

async function search(value: string, name = caption) {
  const input = screen.getByPlaceholderText('Пошук значення')
  act(() => input.focus())
  fireEvent.change(input, { target: { value } })
  return screen.findByRole('option', { name: name.replace(/\s+/g, ' ') }, { timeout: 4000 })
}

it.each([0, 2])('shows the buyer beside BCE00604 in the actual inline region-code filter for source %i', async source => {
  render(<Form source={source} />)
  fireEvent.click(await search('BCE00604'))
  expect(screen.getByTestId('selection').textContent).toContain(caption)
  const selection = JSON.parse(screen.getByTestId('selection').textContent!)
  expect(selection.Values).toHaveLength(1)
  expect(selection.Values[0]).toMatchObject({ Name: caption, Value: 903420, Data: { Id: 903420, RegionCodeId: 903420, Value: 'BCE00604' } })
  expect(selection.Values[0].Data.Id).not.toBe(buyer.Id)
  expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/clients/reports/stocks/search', expect.objectContaining({
    query: expect.objectContaining({ value: 'BCE00604', limit: 30, offset: 0 }), signal: expect.any(AbortSignal),
  }))
})

it('searches by buyer name and excludes clients without a region code', async () => {
  render(<Form condition={0} />)
  const option = await search('Марчук')
  expect(screen.getAllByRole('option')).toHaveLength(1)
  fireEvent.click(option)
  await waitFor(() => expect(JSON.parse(screen.getByTestId('selection').textContent!).Values).toHaveLength(1))
  expect(screen.queryByRole('option', { name: /Олена/ })).toBeNull()
  expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/clients/reports/stocks/search', expect.objectContaining({ query: expect.objectContaining({ value: 'Марчук' }) }))
})

it.each([0, 2])('preserves exact code identities and promotes multiple choices to a list from condition %i', async condition => {
  render(<Form condition={condition} />)
  fireEvent.click(await search('BCE00604'))
  const secondCaption = `${secondBuyer.RegionCode.Value} — ${secondBuyer.Name}`
  fireEvent.click(await search('BCE00605', secondCaption))
  const selection = JSON.parse(screen.getByTestId('selection').textContent!)
  expect(selection.Values.map((value: { Data: { RegionCodeId: number } }) => value.Data.RegionCodeId))
    .toEqual([903420, 901653])
  expect(selection.FilterCondition.Type).toBe(2)
  expect(selection.Values.at(-1)).toMatchObject({ Name: secondCaption, Value: 901653, Data: { Id: 901653, RegionCodeId: 901653 } })
})

it('shows the buyer name through the sales navigation and report filter row from the screenshot', async () => {
  render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
  const navigation = await screen.findByRole('navigation', { name: 'Розділи звітів' })
  const sales = within(navigation).getByRole('button', { name: 'Продажі' })
  await waitFor(() => expect(sales).toHaveProperty('disabled', false))
  fireEvent.click(sales)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Звіт по продажам' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  const row = screen.getByRole('group', { name: 'Умова відбору 1' })
  fireEvent.click(within(row).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: field.Name.replace(/ \[\d+\]$/,'') }))
  fireEvent.click(await search('BCE00604'))
  expect(screen.getByRole('group', { name: 'Умова відбору 1' }).textContent).toContain(caption)
})
