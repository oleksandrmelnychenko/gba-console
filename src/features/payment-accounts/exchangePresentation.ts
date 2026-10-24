import { PaymentRegisterTransferType, type PaymentRegisterCurrencyExchange } from './types'

// History endpoints already project Amount onto the selected currency leg.
// A booked target is authoritative; never convert the projected amount again.
export function exchangeDisplayAmount(exchange: PaymentRegisterCurrencyExchange): number | undefined {
  return exchange.Type === PaymentRegisterTransferType.Income
    ? exchange.TargetAmount ?? exchange.Amount
    : exchange.Amount
}

export function exchangeCurrencyCode(exchange: PaymentRegisterCurrencyExchange): string | undefined {
  return exchange.Type === PaymentRegisterTransferType.Income
    ? exchange.ToPaymentCurrencyRegister?.Currency?.Code
    : exchange.FromPaymentCurrencyRegister?.Currency?.Code
}

export function exchangeRowId(exchange: PaymentRegisterCurrencyExchange, index: number): string {
  return `${exchange.NetUid || exchange.Id || `exchange-${index}`}:${exchange.Type ?? 'unknown'}`
}
