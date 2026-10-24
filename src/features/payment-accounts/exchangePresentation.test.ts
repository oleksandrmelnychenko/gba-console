import { describe, expect, it } from 'vitest'
import { exchangeCurrencyCode, exchangeDisplayAmount, exchangeRowId } from './exchangePresentation'
import { PaymentRegisterTransferType, type PaymentRegisterCurrencyExchange } from './types'

describe('exchange history legs', () => {
  const source: PaymentRegisterCurrencyExchange = {
    NetUid: 'same-document', Amount: 100, ExchangeRate: 42, TargetAmount: 4199.99,
    FromPaymentCurrencyRegister: { Currency: { Code: 'EUR' }, PaymentRegister: { Id: 10 } },
    ToPaymentCurrencyRegister: { Currency: { Code: 'UAH' }, PaymentRegister: { Id: 10 } },
    Type: PaymentRegisterTransferType.Outcome,
  }
  const target = { ...source, Amount: 4199.99, Type: PaymentRegisterTransferType.Income }

  it('shows both legs within one account with different row identities and currencies', () => {
    expect(exchangeDisplayAmount(source)).toBe(100)
    expect(exchangeDisplayAmount(target)).toBe(4199.99)
    expect(exchangeCurrencyCode(source)).toBe('EUR')
    expect(exchangeCurrencyCode(target)).toBe('UAH')
    expect(exchangeRowId(source, 0)).not.toBe(exchangeRowId(target, 1))
  })

  it('never converts the already projected target amount again on a receiving bank account', () => {
    const receivingBank = { ...target, ToPaymentCurrencyRegister: { ...target.ToPaymentCurrencyRegister, PaymentRegister: { Id: 11 } } }
    expect(exchangeDisplayAmount(receivingBank)).toBe(4199.99)
    expect(exchangeDisplayAmount({ ...receivingBank, TargetAmount: null })).toBe(4199.99)
  })

  it('retains a stored zero instead of falling back to a different amount', () => {
    expect(exchangeDisplayAmount({ ...target, TargetAmount: 0 })).toBe(0)
  })
})
