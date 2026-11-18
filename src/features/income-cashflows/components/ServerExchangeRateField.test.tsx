import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ServerExchangeRateField } from './ServerExchangeRateField'
import { formatServerExchangeRate } from './serverExchangeRate'

describe('ServerExchangeRateField', () => {
  it('shows the system rate read-only, since the server discards a typed rate on create (currency#7)', () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <ServerExchangeRateField value={51.2} />
        </I18nProvider>
      </MantineProvider>,
    )

    // The payment is converted at the commercial rate, and the label says which rate it is.
    const input = screen.getByLabelText('Комерційний курс') as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('51,2')
  })

  it('formats unknown or zero rates as a dash and keeps six decimals', () => {
    expect(formatServerExchangeRate(0)).toBe('—')
    expect(formatServerExchangeRate(undefined)).toBe('—')
    expect(formatServerExchangeRate(1.1082251)).toBe('1,108225')
  })
})
