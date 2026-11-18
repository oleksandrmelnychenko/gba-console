/* Which rate a screen shows (owner decision: the logic stays, the user is told
   which rate is used). Verified on the server, 18.11.2026:
   - income and outgoing payment orders convert into the agreement currency at the
     COMMERCIAL rate (ExchangeRate / CrossExchangeRate tables, PaymentOrdersCurrencyConvertor);
   - sales price in EUR and convert at the COMMERCIAL rate (OrderItem.ExchangeRateAmount);
   - the client settlements statement shows the hryvnia equivalent of a foreign-currency
     payment at the NBU rate of the payment date (GetGovExchangedToUahValue). */
export const COMMERCIAL_RATE_LABEL = 'Комерційний курс'
export const NBU_RATE_LABEL = 'Курс НБУ'

type SaleWithRate = {
  ClientAgreement?: { Agreement?: { Currency?: { Code?: string | null } | null } | null } | null
  Order?: { OrderItems?: Array<{ ExchangeRateAmount?: number | null; Deleted?: boolean }> | null } | null
}

/** «Комерційний курс EUR → USD» of a sale: the rate its EUR prices were converted at
    (OrderItem.ExchangeRateAmount). Null for an EUR agreement or when no line carries a rate. */
export function getSaleCommercialRate(sale: SaleWithRate | null | undefined): { pair: string; rate: number } | null {
  const currency = sale?.ClientAgreement?.Agreement?.Currency?.Code?.trim().toUpperCase() || ''
  if (!currency || currency === 'EUR') return null

  const rate = sale?.Order?.OrderItems?.find((item) => !item.Deleted && typeof item.ExchangeRateAmount === 'number'
    && Number.isFinite(item.ExchangeRateAmount) && item.ExchangeRateAmount > 0)?.ExchangeRateAmount

  return typeof rate === 'number' ? { pair: `EUR → ${currency}`, rate } : null
}

export function formatCommercialRate(rate: number): string {
  return rate.toLocaleString('uk-UA', { maximumFractionDigits: 6, minimumFractionDigits: 2 })
}
