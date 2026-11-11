import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { groupDescriptor } from '../data/currentVparivanieAnalysis.group-selection.test-fixtures'
import { priceDatasetFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { reportProductDataset } from '../data/reportProductLookup.test-fixtures'
import { returnStatusDataset } from '../data/returnItemStatuses.test-fixtures'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
import { ReturnItemStatusPicker } from './ReturnItemStatusPicker'
import { SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)

type Query = Record<string, unknown> | undefined
const named = [{ Id: 101, Name: 'ALFA' }, { Id: 102, Name: 'BETA' }]
function lookup(path: string, query: Query): unknown {
  if (path === '/report/datasets/lookup' && query?.dataSource === 44 && query.field === 3) return [{ Name: 'ALFA', Id: 9 }, { Name: 'BETA', Id: 1 }]
  if (path === '/report/datasets/lookup' && query?.dataSource === 44 && [4, 9, 15, 16, 21].includes(Number(query.field)))
    return [{ Id: '101', Name: 'ALFA' }, { Id: '102', Name: 'BETA' }]
  if (path === '/report/datasets/lookup' && [35, 38, 40, 41, 43].includes(Number(query?.dataSource)))
    return [{ Id: '101', Name: 'ALFA', NetUid: 'net-101' }, { Id: '102', Name: 'BETA', NetUid: 'net-102' }]
  if (path === '/report/datasets/lookup') return named
  if (path === '/usermanagement/profiles/search/lookup') return [{ Id: 101, LastName: 'ALFA' }, { Id: 102, LastName: 'BETA' }]
  if (path === '/organizations/all') return named
  if (path === '/regions/all/codes') return [
    { Id: 101, Name: 'ALFA', RegionCodes: [{ Id: 201, RegionId: 101, Value: 'ALFA-1' }, { Id: 202, RegionId: 101, Value: 'BETA-2' }] },
    { Id: 102, Name: 'BETA', RegionCodes: [] },
  ]
  if (path === '/report/datasets/price-comparison/filters/lookup') return query?.field === 3
    ? [{ Id: 'ALFA', Name: 'ALFA' }, { Id: 'BETA', Name: 'BETA' }]
    : [{ Id: '101', Name: 'ALFA [101]' }, { Id: '102', Name: 'BETA [102]' }]
  if (path === '/report/datasets/sales/products/lookup' || path === '/report/datasets/products/lookup')
    return [{ Id: '101', Name: 'ALFA', VendorCode: 'A-1' }, { Id: '102', Name: 'BETA', VendorCode: 'B-2' }]
  if (path === '/report/datasets/current-vparivanie/analysis/lookup') return query?.field === 3
    ? [{ id: 'top:ALFA', name: 'ALFA', data: '{"name":"ALFA"}' }, { id: 'top:BETA', name: 'BETA', data: '{"name":"BETA"}' }]
    : [{ id: '101', name: 'ALFA', data: '{"Id":101}' }, { id: '102', name: 'BETA', data: '{"Id":102}' }]
  if (path === '/products/groups/get/top') return [{ Id: 1, Name: 'ALFA' }, { Id: 2, Name: 'BETA' }]
  return []
}

const salesProductDataset = {
  DataSource: 2, Filters: [{ Type: 1, Name: 'Товар' }],
  salesProductLookup: { version: 1, fieldTypes: [1], identityKind: 'positiveInt64String', periodRequired: false,
    supportsNameAndArticleSearch: true, exactIdParameter: 'exactId', paging: 'offset', maximumPageSize: 50 },
} as ReportDataset

type Case = {
  name: string; source: number; field: number; dataset?: ReportDataset; profitReadMode?: 0
  render?: (selection: ReportSelection, onChange: (values: ReportSelectedValue[]) => void) => ReactNode
  conditions?: number[]
}
const common = (source: number, field: number, profitReadMode?: 0): Case => ({ name: `${source}/${field} common`, source, field, profitReadMode })
const cases: Case[] = [
  common(35, 17, 0), common(38, 17, 0), common(40, 30), common(41, 17), common(43, 17), common(45, 17),
  common(2, 6), common(3, 21), common(44, 2), common(46, 6),
  { name: '3/3 shared TOP list', source: 3, field: 3 },
  { name: '2/1 sales product', source: 2, field: 1, dataset: salesProductDataset },
  ...([3, 44, 45, 46] as const).map(source => ({ name: `${source}/1 report product`, source, field: 1, dataset: reportProductDataset(source) })),
  ...[3, 4, 10, 15].map(field => ({ name: `46/${field} price filter`, source: 46, field, dataset: priceDatasetFixture() })),
  ...[3, 1, 4, 8, 9, 10, 15, 16, 21, 0, 7].map(field => ({ name: `44/${field} customer group`, source: 44, field })),
  { name: '39/3 analysis value', source: 39, field: 3,
    render: (selection, onChange) => <CurrentVparivanieAnalysisValuePicker selection={selection} selections={[]} from="2026-10-01" to="2026-10-27" onChange={onChange} /> },
  { name: '39/4 analysis groups', source: 39, field: 4, conditions: [3, 0],
    render: (selection, onChange) => <CurrentVparivanieAnalysisValuePicker descriptor={groupDescriptor} selection={selection} selections={[]} from="2026-10-01" to="2026-10-27" onChange={onChange} /> },
]

function Form({ item, condition }: { item: Case; condition: number }) {
  const [values, setValues] = useState<ReportSelectedValue[]>([])
  const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: item.field, Name: `Поле ${item.field}` },
    FilterCondition: { Type: condition, Name: `Умова ${condition}` }, Values: values }
  return <MantineProvider env="test"><I18nProvider>
    {item.render ? item.render(selection, setValues) : <SelectionValuePicker dataSource={item.source} dataset={item.dataset}
      lookupProfitReadMode={item.profitReadMode} from="2026-10-01" to="2026-10-27" label="Значення"
      selection={selection} selections={[selection]} onChange={setValues} />}
    <output data-testid="request">{JSON.stringify({ dataSource: item.source, selections: [selection] })}</output>
  </I18nProvider></MantineProvider>
}

async function choose(name: string) {
  const box = screen.getAllByRole('combobox')[0]
  act(() => box.focus())
  fireEvent.change(box, { target: { value: name.slice(0, 3) } })
  const options = await screen.findAllByRole('option', { name: new RegExp(`^${name}`) }, { timeout: 4000 })
  fireEvent.click(options[0])
}
const request = () => screen.getByTestId('request').textContent

beforeEach(() => {
  api.mockReset()
  api.mockImplementation(async (path, options) => lookup(path, options?.query as Query))
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it.each(cases.flatMap(item => (item.conditions ?? [2, 0]).map(condition => ({ item, condition, title: `${item.name} c${condition}` }))))(
  'sends the same selection for $title', async ({ item, condition }) => {
    render(<Form item={item} condition={condition} />)
    await choose('ALFA')
    const first = request()
    await choose('BETA')
    expect({ afterFirstChoice: first, afterSecondChoice: request() }).toMatchSnapshot()
  })

it.each([2, 0])('sends the same selection for a free-text field condition %i', async condition => {
  const item: Case = { name: 'free text', source: 3, field: 22 }
  render(<Form item={item} condition={condition} />)
  for (const text of ['4711', 'A-15']) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
  }
  expect(request()).toMatchSnapshot()
})

it.each([2, 0])('sends the same selection for the return status condition %i', async condition => {
  const item: Case = { name: 'return status', source: 2, field: 64,
    render: (selection, onChange) => <ReturnItemStatusPicker dataset={returnStatusDataset as ReportDataset} selection={selection} onChange={onChange} /> }
  render(<Form item={item} condition={condition} />)
  await choose('Причина 0')
  const first = request()
  await choose('Брак')
  expect({ afterFirstChoice: first, afterSecondChoice: request() }).toMatchSnapshot()
})
