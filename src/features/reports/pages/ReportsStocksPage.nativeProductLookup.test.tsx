import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { SelectionValuePicker } from './ReportsStocksPage'
import type { ReportDataset, ReportSelectedValue } from '../types'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const cap = {
  version: 1,
  fieldTypes: [1],
  identityKind: 'positiveInt64String',
  periodRequired: false,
  supportsNameAndArticleSearch: true,
  exactIdParameter: 'exactId',
  paging: 'offset',
  maximumPageSize: 50,
}
const selected = structuredClone([
  { Data: '{"Id":"9007199254740993"}', Name: 'Старий', Value: 0 },
]) as unknown as ReportSelectedValue[]
function Form({
  source = 2,
  capability = cap,
  from = '2026-10-01',
}: {
  source?: number
  capability?: unknown
  from?: string
}) {
  return (
    <MantineProvider env="test">
      <I18nProvider>
        <SelectionValuePicker
          dataSource={source}
          dataset={
            {
              DataSource: source,
              Filters: [{ Type: 1, Name: 'Товар' }],
              salesProductLookup: capability,
            } as ReportDataset
          }
          from={from}
          to="2026-10-30"
          selection={{
            IsChecked: true,
            SelectedField: { Type: 1, Name: 'Товар' },
            FilterCondition: { Type: 2, Name: 'У списку' },
            Values: selected,
          }}
          selections={[]}
          onChange={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>
  )
}
beforeEach(() => {
  api.mockReset().mockResolvedValue([])
})
afterEach(cleanup)
it('routes real scalar source2 to new API and does not refetch or rewrite values on period edits', async () => {
  const view = render(<Form />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  expect(api.mock.calls[0][0]).toBe('/report/datasets/sales/products/lookup')
  view.rerender(<Form from="2026-09-01" />)
  expect(api).toHaveBeenCalledOnce()
  expect(screen.getAllByText('Старий')[0]).toBeTruthy()
  expect(selected[0].Data).toBe('{"Id":"9007199254740993"}')
})
it('malformed advertised capability disables transport, retains saved values', () => {
  render(<Form capability={{ ...cap, version: 2 }} />)
  expect(api).not.toHaveBeenCalled()
  expect(screen.getAllByText('Старий')[0]).toBeTruthy()
  expect(screen.getByText(/Вибір товарів зараз недоступний/)).toBeTruthy()
})

it('aborts native transport on capability removal while retaining saved raw values', async () => {
  api.mockImplementation(() => new Promise(() => {}))
  const view = render(<Form />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  const signal = api.mock.calls[0][1]?.signal
  view.rerender(<Form capability={{ ...cap, version: 2 }} />)
  expect(signal?.aborted).toBe(true)
  expect(api).toHaveBeenCalledOnce()
  expect(selected[0].Data).toBe('{"Id":"9007199254740993"}')
})
it('keeps source44 on its existing lookup route', async () => {
  render(<Form source={44} />)
  await userEvent.type(screen.getByRole('combobox'), 'Product')
  await waitFor(() => expect(api).toHaveBeenCalled())
  expect(api.mock.calls.every((call) => call[0] !== '/report/datasets/sales/products/lookup')).toBe(true)
})
