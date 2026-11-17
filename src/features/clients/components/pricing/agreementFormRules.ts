import type { Agreement, Pricing } from '../../types'
import { PRICING_NAME_BULK_TWO, PRICING_NAME_BULK_TWO_VAT } from './pricingNames'

export function filterPricingsByVat(items: Pricing[], withVat: boolean | undefined): Pricing[] {
  return items.filter((pricing) => Boolean(pricing.ForVat) === Boolean(withVat))
}

/* «Облік з ПДВ» switches both price types to the matching family. Clearing only
   «Тип ціни» left the select blank while the stored id stayed, and «Акційний тип
   ціни» kept a VAT price type on a non-VAT agreement. */
export function vatAccountingPatch(withVat: boolean, pricings: Pricing[], promotionalPricings: Pricing[]): Partial<Agreement> {
  const name = withVat ? PRICING_NAME_BULK_TWO_VAT : PRICING_NAME_BULK_TWO
  const pricing = findByName(pricings, name)
  const promotionalPricing = findByName(promotionalPricings, name)

  return {
    WithVATAccounting: withVat,
    Pricing: pricing,
    PricingId: pricing?.Id,
    PromotionalPricing: promotionalPricing,
    PromotionalPricingId: promotionalPricing?.Id,
  }
}

/* Сума боргу: non-negative, cents. */
export function toMoneyAmount(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

/* Кількість днів боргу: a whole non-negative number (7.5 made the card save fail with 400). */
export function toWholeDays(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function findByName<T extends { Name?: string }>(items: T[], name: string): T | undefined {
  return items.find((item) => item.Name === name)
}

export function toOptions(items: Array<{ Id?: number; Name?: string }>): Array<{ label: string; value: string }> {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    if (typeof item.Id === 'number' && item.Id > 0) {
      options.push({
        /* Unnamed rows exist in shared data; a blank option is unpickable and confusing. */
        label: item.Name?.trim() || `Без назви (#${item.Id})`,
        value: String(item.Id),
      })
    }

    return options
  }, [])
}
