import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { NativeSalesProductPicker } from './NativeSalesProductPicker'
import type { ReportDataset } from '../types'
const productDataset = {
  DataSource: 2,
  Filters: [{ Type: 1, Name: 'Товар' }],
  salesProductLookup: {
    version: 1,
    fieldTypes: [1],
    identityKind: 'positiveInt64String',
    periodRequired: false,
    supportsNameAndArticleSearch: true,
    exactIdParameter: 'exactId',
    paging: 'offset',
    maximumPageSize: 50,
  },
} as ReportDataset
import type { ReportSelectedValue } from '../types'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest),
  saved = [
    { Data: JSON.stringify({ Id: '9007199254740993' }), Name: 'Збережений', Value: 0 },
  ] as unknown as ReportSelectedValue[]
function Form({ condition = 2, initial = saved }: { condition?: number; initial?: ReportSelectedValue[] }) {
  const [values, setValues] = useState(initial)
  return (
    <MantineProvider env="test">
      <I18nProvider>
        <NativeSalesProductPicker
          dataset={productDataset}
          selection={{
            IsChecked: true,
            SelectedField: { Type: 1, Name: 'Товар' },
            FilterCondition: { Type: condition, Name: 'Умова' },
            Values: values,
          }}
          onChange={setValues}
        />
        <output data-testid="values">{JSON.stringify(values)}</output>
      </I18nProvider>
    </MantineProvider>
  )
}
const values = () => JSON.parse(screen.getByTestId('values').textContent!)
beforeEach(() => {
  api.mockReset()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)
it('pages65 real identities and chooses page3 while retaining raw saved data', async () => {
  api.mockImplementation(async (_path, options) =>
    Array.from({ length: 65 }, (_, i) => ({ Id: String(i + 1), Name: 'Одна назва', VendorCode: 'SKU' + i })).slice(
      Number(options?.query?.offset),
      Number(options?.query?.offset) + 30,
    ),
  )
  render(<Form />)
  await screen.findByRole('button', { name: 'Ще товари' })
  await userEvent.click(screen.getByRole('button', { name: 'Ще товари' }))
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
  await userEvent.click(screen.getByRole('button', { name: 'Ще товари' }))
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3))
  await userEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Одна назва · SKU64 [65]' }))
  expect(values()).toEqual([...saved, { Data: { Id: '65' }, Name: 'Одна назва · SKU64', Value: 0 }])
  expect(api.mock.calls.map((x) => x[1]?.query?.offset)).toEqual([0, 30, 60])
  expect(screen.queryByRole('button', { name: 'Ще товари' })).toBeNull()
})
it('explicit archived recheck never erases raw selected values and is never automatic', async () => {
  api.mockResolvedValue([])
  render(<Form />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('button', { name: 'Перевірити ID 9007199254740993' }))
  await screen.findByText(/Товар недоступний/)
  expect(values()).toEqual(saved)
  expect(api).toHaveBeenCalledTimes(2)
})
it('invalid exact ID hides old options and never requests a rounded ID', async () => {
  api.mockResolvedValue([{ Id: '1', Name: 'Старий', VendorCode: '' }])
  render(<Form initial={[]} condition={0} />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('radio', { name: 'Точний ID' }))
  const box = screen.getByRole('combobox', { name: 'Точний ID товару' })
  await userEvent.type(box, '01')
  await screen.findByText(/правильний позитивний ID/)
  expect(api).toHaveBeenCalledOnce()
  expect(screen.queryByRole('option', { name: 'Старий [1]' })).toBeNull()
})

it('selects an exact Int64 maximum by keyboard without changing its identity', async () => {
  api.mockImplementation(async (_path, options) =>
    options?.query?.exactId ? [{ Id: '9223372036854775807', Name: 'Максимум', VendorCode: 'MAX' }] : [],
  )
  render(<Form initial={[]} condition={0} />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('radio', { name: 'Точний ID' }))
  await userEvent.type(screen.getByRole('combobox', { name: 'Точний ID товару' }), '9223372036854775807')
  await screen.findByRole('option', { name: 'Максимум · MAX [9223372036854775807]' })
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(values()).toEqual([{ Data: { Id: '9223372036854775807' }, Name: 'Максимум · MAX', Value: 0 }])
  expect(api.mock.calls.at(-1)?.[1]?.query).toEqual({ exactId: '9223372036854775807', offset: 0, limit: 30 })
})
it('offers a focusable retry after failure and retains selected raw values', async () => {
  api.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  render(<Form />)
  const retry = await screen.findByRole('button', { name: 'Повторити пошук' })
  retry.focus()
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
  expect(values()).toEqual(saved)
  expect(screen.queryByText(/Не вдалося завантажити товари/)).toBeNull()
})
