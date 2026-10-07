import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrencyRateDynamicsDefinitions } from '../api/currencyRateDynamicsApi'
import type { CurrencyRateDynamicsDefinition } from '../data/currencyRateDynamics'
import { currencyDynamicsDefinition } from '../data/currencyRateDynamics.test-fixtures'
import { CurrencyRateDynamicsRatePicker } from './CurrencyRateDynamicsRatePicker'

vi.mock('../api/currencyRateDynamicsApi', () => ({ getCurrencyRateDynamicsDefinitions: vi.fn() }))
vi.mock('@mantine/hooks', async original => ({ ...await original<typeof import('@mantine/hooks')>(),
  useDebouncedValue: (value: string) => [value],
}))
beforeEach(() => {
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockReset()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
function picker(onChange: (value: CurrencyRateDynamicsDefinition | null) => void, enabled = true, callerKey = 'caller-a', value: CurrencyRateDynamicsDefinition | null = null) {
  return <MantineProvider env="test"><I18nProvider><CurrencyRateDynamicsRatePicker value={value}
    enabled={enabled} callerKey={callerKey} onChange={onChange} /></I18nProvider></MantineProvider>
}
it('uses only genuine backend choices with exact bigint identity and ordered-pair labels', async () => {
  const selected = currencyDynamicsDefinition(), change = vi.fn()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockResolvedValue([selected])
  render(picker(change))
  fireEvent.click(screen.getByRole('combobox', { name: 'Валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /USD.*UAH.*9007199254740993/ }))
  expect(change).toHaveBeenCalledWith(selected)
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledWith('', 0, 25, expect.any(AbortSignal))
})
it('loads the next bounded page without replacing the selected series', async () => {
  const first = Array.from({ length: 25 }, (_, index) => ({ ...currencyDynamicsDefinition(), RateDefinitionId: String(1000 + index),
    BaseCurrencyId: String(200 + index), BaseCode: `B${index}`, BaseName: `Валюта ${index}` }))
  const selected = currencyDynamicsDefinition(), change = vi.fn()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockResolvedValueOnce(first).mockResolvedValueOnce([currencyDynamicsDefinition(true)])
  render(picker(change, true, 'caller-a', selected))
  const more = await screen.findByRole('button', { name: 'Завантажити ще валютні пари' })
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledOnce()
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledWith('', 0, 25, expect.any(AbortSignal))
  fireEvent.click(more)
  await waitFor(() => expect(getCurrencyRateDynamicsDefinitions).toHaveBeenNthCalledWith(2, '', 25, 25, expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox', { name: 'Валюта' }))
  await screen.findByRole('option', { name: /EUR.*UAH/ })
  expect((screen.getByRole('combobox', { name: 'Валюта' }) as HTMLInputElement).value).toContain('USD')
  expect(change).not.toHaveBeenCalled()
})
it('aborts a stale search and ignores its late rows', async () => {
  let resolve!: (rows: CurrencyRateDynamicsDefinition[]) => void
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockReturnValueOnce(new Promise(done => { resolve = done }))
    .mockResolvedValueOnce([currencyDynamicsDefinition(true)])
  render(picker(vi.fn()))
  await waitFor(() => expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledOnce())
  const oldSignal = vi.mocked(getCurrencyRateDynamicsDefinitions).mock.calls[0][3]!
  const input = screen.getByRole('combobox', { name: 'Валюта' })
  act(() => input.focus())
  fireEvent.change(input, { target: { value: 'EUR' } })
  await waitFor(() => expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledTimes(2))
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenNthCalledWith(2, 'EUR', 0, 25, expect.any(AbortSignal))
  expect(oldSignal.aborted).toBe(true)
  await act(async () => { resolve([currencyDynamicsDefinition()]) })
  fireEvent.click(screen.getByRole('combobox', { name: 'Валюта' }))
  await screen.findByRole('option', { name: /EUR.*UAH/ })
  expect(screen.queryByRole('option', { name: /USD.*UAH/ })).toBeNull()
})
it('keeps an existing selection while sending genuine free-text searches unchanged', async () => {
  const selected = currencyDynamicsDefinition(), next = currencyDynamicsDefinition(true), change = vi.fn()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockResolvedValueOnce([selected]).mockResolvedValueOnce([next])
  render(picker(change, true, 'caller-a', selected))
  const input = screen.getByRole('combobox', { name: 'Валюта' })
  act(() => input.focus())
  await screen.findByRole('option', { name: /USD.*UAH/ })
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledOnce()
  fireEvent.change(input, { target: { value: 'EUR' } })
  await screen.findByRole('option', { name: /EUR.*UAH/ })
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenNthCalledWith(2, 'EUR', 0, 25, expect.any(AbortSignal))
  expect(screen.getByRole('option', { name: /USD.*UAH/ })).toBeTruthy()
  expect(change).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('option', { name: /EUR.*UAH/ }))
  expect(change).toHaveBeenCalledWith(next)
})
it('preserves a known selection on lookup failure and retries only by explicit user action', async () => {
  const selected = currencyDynamicsDefinition(), change = vi.fn()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockRejectedValueOnce(new Error('Lookup unavailable')).mockResolvedValueOnce([])
  render(picker(change, true, 'caller-a', selected))
  const retry = await screen.findByRole('button', { name: 'Повторити' })
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledOnce()
  expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledWith('', 0, 25, expect.any(AbortSignal))
  fireEvent.click(retry)
  await waitFor(() => expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('combobox', { name: 'Валюта' }) as HTMLInputElement).value).toContain('USD')
  expect(change).not.toHaveBeenCalled()
})
it('does no lookup without permission and ignores a pending lookup after permission loss', async () => {
  let resolve!: (rows: CurrencyRateDynamicsDefinition[]) => void
  const change = vi.fn()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockReturnValue(new Promise(done => { resolve = done }))
  const view = render(picker(change, false))
  expect(getCurrencyRateDynamicsDefinitions).not.toHaveBeenCalled()
  view.rerender(picker(change, true))
  await waitFor(() => expect(getCurrencyRateDynamicsDefinitions).toHaveBeenCalledOnce())
  view.rerender(picker(change, false))
  await act(async () => { resolve([currencyDynamicsDefinition()]) })
  expect((screen.getByRole('combobox', { name: 'Валюта' }) as HTMLInputElement).disabled).toBe(true)
  expect(change).not.toHaveBeenCalled()
})
