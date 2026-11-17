import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { Agreement, Pricing } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'
import { isWholeDays, toDaysValue, toMoneyAmount, toOptions, vatAccountingPatch } from './agreementFormRules'
import { PRICING_NAME_BULK_TWO, PRICING_NAME_BULK_TWO_VAT } from './pricingNames'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const nonVat = { ForVat: false, Id: 10, Name: PRICING_NAME_BULK_TWO } as Pricing
const vat = { ForVat: true, Id: 11, Name: PRICING_NAME_BULK_TWO_VAT } as Pricing

describe('agreement form rules', () => {
  it('unticking «Облік з ПДВ» moves both price types (and their ids) to the non-VAT family', () => {
    expect(vatAccountingPatch(false, [nonVat, vat], [nonVat, vat])).toEqual({
      WithVATAccounting: false,
      Pricing: nonVat,
      PricingId: 10,
      PromotionalPricing: nonVat,
      PromotionalPricingId: 10,
    })
    expect(vatAccountingPatch(true, [nonVat, vat], [nonVat, vat]).PromotionalPricingId).toBe(11)
  })

  it('Сума боргу keeps cents only and is never negative; days are whole', () => {
    expect(toMoneyAmount(500.555)).toBe(500.56)
    expect(toMoneyAmount('500,5')).toBe(500.5)
    expect(toMoneyAmount(-5)).toBe(0)
    // Days stay as typed so «7.5» is not silently 75 or 7; the fraction is reported.
    expect(toDaysValue('7.5')).toBe(7.5)
    expect(isWholeDays(7.5)).toBe(false)
    expect(isWholeDays(30)).toBe(true)
    expect(toDaysValue(-3)).toBe(0)
  })

  it('a new buyer agreement is not «full prepayment» by default', () => {
    const onSave = vi.fn<(agreement: Agreement, isEdit: boolean) => void>()
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientAgreementsPanel
            agreements={[]}
            currencies={[]}
            isProvider={false}
            organizations={[]}
            pricings={[nonVat, vat]}
            promotionalPricings={[nonVat, vat]}
            sourceEditMode="manual"
            onDeleteAgreement={vi.fn()}
            onSaveAgreement={onSave}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Додати договір' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Зберегти' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ IsPrePaymentFull: false, PrePaymentPercentages: 0 })
  })
})

describe('agreement pickers', () => {
  it('an organization without a name gets a visible label instead of a blank option', () => {
    expect(toOptions([{ Id: 3, Name: '' }, { Id: 4, Name: 'QA ТОВ' }, { Id: 0, Name: 'new' }])).toEqual([
      { label: 'Без назви (#3)', value: '3' },
      { label: 'QA ТОВ', value: '4' },
    ])
  })
})

describe('«Кількість днів боргу» with a fraction', () => {
  it('is reported under the field and the agreement is not saved', () => {
    const onSave = vi.fn()
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientAgreementsPanel
            agreements={[{ Id: 1, NetUid: 'ca-1', Agreement: { Id: 2, NetUid: 'a-2', Name: 'Основний', Pricing: nonVat, NumberDaysDebt: 7.5 } }]}
            currencies={[]}
            isProvider={false}
            organizations={[]}
            pricings={[nonVat, vat]}
            promotionalPricings={[nonVat, vat]}
            sourceEditMode="manual"
            onDeleteAgreement={vi.fn()}
            onSaveAgreement={onSave}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(within(dialog).getAllByText('Кількість днів — ціле число').length).toBeGreaterThan(0)
    expect(onSave).not.toHaveBeenCalled()
  })
})
