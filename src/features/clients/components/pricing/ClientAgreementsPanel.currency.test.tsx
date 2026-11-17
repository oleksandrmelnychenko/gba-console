import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { ClientAgreement, Currency, Pricing } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const pricings = [{ ForVat: false, Id: 1, Name: 'Роздріб' }] as Pricing[]
const currencies = [{ Id: 7, Name: 'EUR' }, { Id: 8, Name: 'UAH' }] as Currency[]

function renderPanel(agreements: ClientAgreement[]) {
  const onSave = vi.fn()
  render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientAgreementsPanel
          agreements={agreements}
          currencies={currencies}
          isProvider={false}
          organizations={[]}
          pricings={pricings}
          promotionalPricings={[]}
          sourceEditMode="manual"
          onDeleteAgreement={vi.fn()}
          onSaveAgreement={onSave}
        />
      </I18nProvider>
    </MantineProvider>,
  )
  return onSave
}

const withoutCurrency: ClientAgreement = {
  Id: 1,
  NetUid: 'client-agreement-1',
  Agreement: { Id: 2, NetUid: 'agreement-2', Name: 'Основний', Pricing: pricings[0] },
}

describe('agreement dialog currency', () => {
  it('refuses to save an agreement without a currency, under the field', () => {
    const onSave = renderPanel([withoutCurrency])

    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(within(dialog).getByRole('combobox', { name: /^Валюта/ }).getAttribute('aria-invalid')).toBe('true')
    expect(within(dialog).getAllByText('Не обрано - Валюта').length).toBeGreaterThan(0)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps the currency when the already selected option is clicked again', () => {
    const onSave = renderPanel([{ ...withoutCurrency, Agreement: { ...withoutCurrency.Agreement, Currency: currencies[0] } }])

    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const dialog = screen.getByRole('dialog')
    const currency = within(dialog).getByRole('combobox', { name: /^Валюта/ })
    fireEvent.click(currency)
    fireEvent.click(screen.getByRole('option', { name: 'EUR' }))

    expect((currency as HTMLInputElement).value).toBe('EUR')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ Currency: currencies[0] }), true)
  })
})
