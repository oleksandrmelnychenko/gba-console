import { Card, MantineProvider } from '@mantine/core'
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
function Form({
  condition = 2,
  initial = saved,
  portalEnvironment = false,
}: {
  condition?: number
  initial?: ReportSelectedValue[]
  portalEnvironment?: boolean
}) {
  const [values, setValues] = useState(initial)
  return (
    <MantineProvider env={portalEnvironment ? undefined : 'test'}>
      <I18nProvider>
        <Card data-testid="filter-card" style={{ overflow: 'hidden' }}>
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
        </Card>
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
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function mockPortalGeometry() {
  // Match the shared640x320 DOMRect/offset fixture so FloatingUI does not
  // mistake jsdom's zero client area for a detached reference.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
}
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

it('portals scalar options outside a clipping Card and keeps exact string identity on keyboard selection', async () => {
  mockPortalGeometry()
  api.mockResolvedValue([{ Id: '9007199254740993', Name: 'Товар над 2^53', VendorCode: 'SKU1' }])
  render(<Form condition={0} initial={[]} portalEnvironment />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  const option = await screen.findByRole('option', { name: 'Товар над 2^53 · SKU1 [9007199254740993]' })
  const card = screen.getByTestId('filter-card')
  expect(card.style.overflow).toBe('hidden')
  expect(card.contains(option)).toBe(false)
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(values()).toEqual([{ Data: { Id: '9007199254740993' }, Name: 'Товар над 2^53 · SKU1', Value: 0 }])
})
it('portals multi options outside a clipping Card and preserves saved raw data on normal click', async () => {
  mockPortalGeometry()
  api.mockResolvedValue([{ Id: '9223372036854775807', Name: 'Великий товар', VendorCode: 'MAX' }])
  render(<Form portalEnvironment />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  const option = await screen.findByRole('option', { name: 'Великий товар · MAX [9223372036854775807]' })
  const card = screen.getByTestId('filter-card')
  expect(card.style.overflow).toBe('hidden')
  expect(card.contains(option)).toBe(false)
  await userEvent.click(option)
  expect(values()).toEqual([...saved, { Data: { Id: '9223372036854775807' }, Name: 'Великий товар · MAX', Value: 0 }])
})

function mockTypedSearchPages(query: string) {
  api.mockImplementation(async (_path, options) => {
    if (options?.query?.value !== query) return []
    if (options.query.offset === 0)
      return Array.from({ length: 30 }, (_, index) => ({
        Id: String(1000 + index),
        Name: query + ' ' + index,
        VendorCode: 'SKU' + index,
      }))
    return [{ Id: '2000', Name: query + ' друга сторінка', VendorCode: 'NEXT' }]
  })
}
const lookupQueries = () => api.mock.calls.map((call) => call[1]?.query)
it('keeps typed scalar search when clicking More and preserves saved raw IDs', async () => {
  const query = 'Пошук'
  mockTypedSearchPages(query)
  render(<Form condition={0} />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  const input = screen.getByRole('combobox', { name: 'Значення' })
  await userEvent.type(input, query)
  const more = await screen.findByRole('button', { name: 'Ще товари' })
  await userEvent.click(more)
  expect(values()).toEqual(saved)
  await waitFor(() =>
    expect(lookupQueries(), 'Lookup requests after pointer More: ' + JSON.stringify(lookupQueries())).toContainEqual({
      value: query,
      offset: 30,
      limit: 30,
    }),
  )
  expect((input as HTMLInputElement).value).toBe(query)
})
it('keeps typed multi search when keyboard-focusing More and preserves saved raw IDs', async () => {
  const query = 'Пошук'
  mockTypedSearchPages(query)
  render(<Form />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  const input = screen.getByRole('combobox', { name: 'Значення' })
  await userEvent.type(input, query)
  const more = await screen.findByRole('button', { name: 'Ще товари' })
  await userEvent.tab()
  if (document.activeElement !== more) await userEvent.tab()
  expect(values()).toEqual(saved)
  expect(
    document.activeElement,
    'Focus after normal Tab navigation; requests: ' +
      JSON.stringify(lookupQueries()) +
      '; search: ' +
      (input as HTMLInputElement).value,
  ).toBe(more)
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(lookupQueries()).toContainEqual({ value: query, offset: 30, limit: 30 }))
  expect((input as HTMLInputElement).value).toBe(query)
})
