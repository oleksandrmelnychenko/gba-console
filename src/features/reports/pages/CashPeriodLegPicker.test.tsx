import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { cashPeriodLeg, cashPeriodScope } from '../data/cashPeriod.test-fixtures'
import { CashPeriodLegPicker } from './CashPeriodLegPicker'

vi.mock('../api/cashPeriodApi', () => ({ getCashPeriodLegs: vi.fn() }))
const getLegs = vi.mocked(getCashPeriodLegs)
beforeEach(() => getLegs.mockReset())

function show(value: unknown, onChange = vi.fn()) {
  return { onChange, ...render(<MantineProvider env="test">
    <CashPeriodLegPicker value={value} enabled disabled={false} onChange={onChange} />
  </MantineProvider>) }
}

it('selects an exact ID plus NetUID from the bounded native lookup', async () => {
  getLegs.mockResolvedValue([cashPeriodLeg])
  const view = show(undefined)
  fireEvent.click(await screen.findByRole('combobox', { name: 'Рахунок і власна валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  expect(view.onChange).toHaveBeenCalledWith(cashPeriodScope)
  expect(getLegs).toHaveBeenCalledWith('0', 30, expect.any(AbortSignal))
})

it('keeps a saved exact scope pending server lookup and warns on NetUID drift', async () => {
  getLegs.mockResolvedValue([{ ...cashPeriodLeg,
    CurrencyRegisterNetUid: '87654321-1234-1234-1234-1234567890ab' }])
  const view = show(cashPeriodScope)
  expect(await screen.findByText(/Ідентичність цього рахунку змінилася/)).toBeTruthy()
  expect(view.onChange).not.toHaveBeenCalled()
  expect(screen.getByText(/Сервер перевіряє повне покриття періоду/)).toBeTruthy()
  await waitFor(() => expect(getLegs).toHaveBeenCalledOnce())
})
