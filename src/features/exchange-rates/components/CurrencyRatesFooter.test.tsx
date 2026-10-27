import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { useExchangeRates } from '../hooks/useExchangeRates'
import type { ExchangeRatesSnapshot } from '../types'
import { CurrencyRatesFooter } from './CurrencyRatesFooter'

vi.mock('../hooks/useExchangeRates', () => ({ useExchangeRates: vi.fn() }))

const rates: ExchangeRatesSnapshot = {
  commercial: [{ NetUid: 'eur', Code: 'EUR', Amount: 51.4, Culture: 'uk' }],
  commercialCross: [],
  government: [],
  governmentCross: [],
}

function renderFooter(data: ExchangeRatesSnapshot) {
  vi.mocked(useExchangeRates).mockReturnValue({ data, error: null, isLoading: false, refresh: vi.fn() })
  render(<MantineProvider><I18nProvider><CurrencyRatesFooter /></I18nProvider></MantineProvider>)
}

beforeEach(() => {
  vi.mocked(useExchangeRates).mockReset()
})

describe('CurrencyRatesFooter stale commercial rate', () => {
  it('warns with the last commercial rate date once GBA owns a stale rate', () => {
    renderFooter({
      ...rates,
      freshness: { GbaOwnsRates: true, Today: '2026-11-10T00:00:00', CommercialRateDate: '2026-11-06T00:00:00', CommercialBusinessDaysOld: 2, IsCommercialRateStale: true },
    })

    const warning = screen.getByRole('status')
    expect(warning.textContent).toContain('Курс застарів')
    expect(warning.getAttribute('aria-label')).toContain('06.11.2026')
  })

  it('stays quiet while the rate is fresh or before cutover', () => {
    renderFooter({
      ...rates,
      freshness: { GbaOwnsRates: false, Today: '2026-11-10T00:00:00', CommercialRateDate: '2026-10-01T00:00:00', IsCommercialRateStale: false },
    })

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /UAH: EUR 51.4/ })).toBeTruthy()
  })

  it('asks for a rate when GBA owns the rates and none was entered', () => {
    renderFooter({ ...rates, freshness: { GbaOwnsRates: true, Today: '2026-11-10T00:00:00', CommercialRateDate: null, IsCommercialRateStale: true } })

    expect(screen.getByRole('status').getAttribute('aria-label')).toContain('Комерційного курсу немає')
  })
})
