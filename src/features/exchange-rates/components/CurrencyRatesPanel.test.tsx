import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getExchangeRateHistory, updateExchangeRates } from '../api/exchangeRatesApi'
import type { ExchangeRateGroup } from '../types'
import { CurrencyRatesPanel } from './CurrencyRatesPanel'

vi.mock('../api/exchangeRatesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/exchangeRatesApi')>(),
  getExchangeRateHistory: vi.fn(),
  updateExchangeRates: vi.fn(),
}))

const group: ExchangeRateGroup = {
  id: 'commercial-uah', title: 'UAH',
  rates: [{ NetUid: 'usd', Code: 'USD', Amount: 45.3, Culture: 'uk' }],
  historyEndpoint: '/exchangerates/history/specific',
  historyKey: 'ExchangeRateHistories', updateMode: 'single-commercial',
}

function renderPanel() {
  const onRefresh = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<MantineProvider><I18nProvider>
    <CurrencyRatesPanel group={group} onClose={onClose} onRefresh={onRefresh} />
  </I18nProvider></MantineProvider>)
  return { onRefresh, onClose }
}

beforeEach(() => {
  vi.mocked(getExchangeRateHistory).mockReset().mockResolvedValue(
    Array.from({ length: 20 }, (_, index) => ({ ...group.rates[0], NetUid: `history-${index}`, Created: '2026-10-19T12:00:00' })),
  )
  vi.mocked(updateExchangeRates).mockReset().mockResolvedValue(undefined)
})

describe('CurrencyRatesPanel form actions', () => {
  it('opens without submitting, validates, and only saves through the explicit save action', async () => {
    const user = userEvent.setup()
    const { onRefresh } = renderPanel()
    await screen.findByRole('button', { name: 'Завантажити ще' })
    await user.click(screen.getByRole('button', { name: 'Оновити курси' }))
    expect(updateExchangeRates).not.toHaveBeenCalled()
    expect(screen.queryByText('Некоректне значення курсу')).toBeNull()

    fireEvent.change(screen.getByLabelText('USD'), { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(await screen.findByText('Некоректне значення курсу')).toBeTruthy()
    expect(updateExchangeRates).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('USD'), { target: { value: '45.6' } })
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateExchangeRates).toHaveBeenCalledExactlyOnceWith('single-commercial', [expect.objectContaining({ NetUid: 'usd', Amount: 45.6, Culture: 'uk' })]))
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Оновити курси' })).toBeTruthy()
  })

  it('cancels without a write and closes with Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel()
    await screen.findByRole('button', { name: 'Завантажити ще' })
    await user.click(screen.getByRole('button', { name: 'Оновити курси' }))
    await user.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(updateExchangeRates).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Оновити курси' })))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
