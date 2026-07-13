import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { CompetitorWebSearchPanel } from './CompetitorWebSearchPanel'

describe('CompetitorWebSearchPanel', () => {
  it('resets the editable query when the selected product changes', () => {
    const { rerender } = render(
      <MantineProvider>
        <I18nProvider>
          <CompetitorWebSearchPanel
            product={{ MainOriginalNumber: 'OE-1', Name: 'First product', VendorCode: 'SKU-1' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const input = screen.getByLabelText<HTMLInputElement>('Пошуковий запит')
    expect(input.value).toBe('OE-1 SKU-1 First product')

    fireEvent.change(input, { target: { value: 'custom query' } })
    expect(input.value).toBe('custom query')

    rerender(
      <MantineProvider>
        <I18nProvider>
          <CompetitorWebSearchPanel
            product={{ MainOriginalNumber: 'OE-2', Name: 'Second product', VendorCode: 'SKU-2' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByLabelText<HTMLInputElement>('Пошуковий запит').value)
      .toBe('OE-2 SKU-2 Second product')
  })
})
