import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { CustomerGroupChoiceCombobox } from './CustomerGroupChoiceCombobox'
import { ReportFilterRow } from './ReportFilterRow'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'

const supplier = { value: '631568', label: 'AKKUS DOKUM SAN. ve TIC. LTD. STI. [631568]' }

function Row({ children }: { children: ReactNode }) {
  return <MantineProvider><I18nProvider>
    <div className="constructor-filters__table" data-testid="filters-table" style={{ overflowX: 'auto' }}>
      <ReportFilterRow label="Умова відбору 1" field={null} condition={null} value={children} toggle={null} action={null} />
    </div>
  </I18nProvider></MantineProvider>
}

function Autocomplete() {
  const [keys, setKeys] = useState<string[]>([])
  const [search, setSearch] = useState('')
  return <Row>
    <ReportValueAutocomplete label="Значення" data={[supplier]} selected={keys.includes(supplier.value) ? [supplier] : []}
      search={search} onSearchChange={setSearch} onChange={setKeys} />
    <output data-testid="keys">{JSON.stringify(keys)}</output>
  </Row>
}

function Choice({ multiple }: { multiple: boolean }) {
  const [keys, setKeys] = useState<string[]>([])
  const [search, setSearch] = useState('')
  return <Row>
    <CustomerGroupChoiceCombobox label="Значення" data={[supplier]} selected={keys.includes(supplier.value) ? [supplier] : []}
      search={search} onSearchChange={setSearch} onChange={setKeys} multiple={multiple} loading={false}
      placeholder="Пошук значення" emptyMessage="Нічого не знайдено" />
    <output data-testid="keys">{JSON.stringify(keys)}</output>
  </Row>
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each([
  ['the shared multi-value autocomplete', <Autocomplete key="a" />],
  ['the customer-group multi choice', <Choice key="b" multiple />],
  ['the customer-group single choice', <Choice key="c" multiple={false} />],
])('shows the options of %s outside the scrollable filter table and selects the clicked one', async (_name, picker) => {
  render(picker)
  await userEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  const option = await screen.findByRole('option', { name: supplier.label })
  expect(screen.getByTestId('filters-table').contains(option)).toBe(false)
  await userEvent.click(option)
  expect(JSON.parse(screen.getByTestId('keys').textContent!)).toEqual([supplier.value])
})

it('selects the highlighted option of the shared autocomplete with the keyboard', async () => {
  render(<Autocomplete />)
  await userEvent.type(screen.getByRole('combobox', { name: 'Значення' }), 'AKK')
  await screen.findByRole('option', { name: supplier.label })
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(JSON.parse(screen.getByTestId('keys').textContent!)).toEqual([supplier.value])
})
