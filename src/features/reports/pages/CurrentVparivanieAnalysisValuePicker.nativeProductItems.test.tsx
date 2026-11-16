import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
import { NativeSalesProductPicker } from './NativeSalesProductPicker'
import type { ReportDataset, ReportSelectedValue } from '../types'
import type { AnalysisFieldDescriptor } from '../data/currentVparivanieAnalysis'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({
  searchAnalysisValues: vi.fn(),
  getAnalysisHierarchyPage: vi.fn(),
}))
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
const dataset = { DataSource: 2, Filters: [{ Type: 1, Name: 'Товар' }], salesProductLookup: cap } as ReportDataset
const descriptor = {
  type: 1,
  hierarchy: {
    version: 1,
    groupKind: 'productGroup',
    itemKind: 'product',
    itemField: 1,
    groupConditions: [3, 5, 6, 7],
    mixedConditions: [3, 5],
  },
} as AnalysisFieldDescriptor
function Form({ condition = 3 }: { condition?: number }) {
  const [values, setValues] = useState<ReportSelectedValue[]>([
    { Data: { kind: 'productGroup', id: '1' }, Name: 'Group', Value: 0 },
  ])
  return (
    <MantineProvider env="test">
      <I18nProvider>
        <CurrentVparivanieAnalysisValuePicker
          descriptor={descriptor}
          selection={{
            IsChecked: true,
            SelectedField: { Type: 1, Name: 'Товар' },
            FilterCondition: { Type: condition, Name: 'Умова' },
            Values: values,
          }}
          selections={[]}
          from="2026-10-01"
          to="2026-10-30"
          onChange={setValues}
          renderItemPicker={(context) => <NativeSalesProductPicker dataset={dataset} {...context} />}
        />
        <output data-testid="values">{JSON.stringify(values)}</output>
      </I18nProvider>
    </MantineProvider>
  )
}
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockResolvedValue([{ Id: '1', Name: 'Product', VendorCode: 'SKU' }])
  vi.mocked(searchAnalysisValues)
    .mockReset()
    .mockResolvedValue([{ id: '1', name: 'Group', data: { Id: '1' } }])
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)
it.each([3, 5])(
  'retains typed group when selecting same-ID product through injected native picker (%i)',
  async (condition) => {
    render(<Form condition={condition} />)
    await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledOnce())
    await userEvent.click(screen.getByRole('radio', { name: 'Товари' }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce())
    expect(searchAnalysisValues).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Product · SKU [1]' }))
    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([
      { Data: { kind: 'productGroup', id: '1' }, Name: 'Group', Value: 0 },
      { Data: { kind: 'product', id: '1' }, Name: 'Product · SKU', Value: 0 },
    ])
    await userEvent.click(screen.getByRole('radio', { name: 'Групи' }))
    await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledTimes(2))
    expect(apiRequest).toHaveBeenCalledOnce()
  },
)
it.each([6, 7])('group-only condition %i never mounts product API', async (condition) => {
  render(<Form condition={condition} />)
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledOnce())
  expect(apiRequest).not.toHaveBeenCalled()
  expect(screen.queryByRole('radio', { name: 'Товари' })).toBeNull()
})
