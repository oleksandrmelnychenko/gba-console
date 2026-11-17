import { describe, expect, it } from 'vitest'
import { keepPickedRegister, pickRegisterCurrency } from './incomeRegisterSelection'
import type { PaymentRegister } from './types'

const uah = { NetUid: 'uah', Code: 'UAH' }
const eur = { NetUid: 'eur', Code: 'EUR' }
const first = { NetUid: 'r1', Name: 'CH3 Рахунок UAH', PaymentCurrencyRegisters: [{ Currency: uah }] } as PaymentRegister
const picked = { NetUid: 'r2', Name: 'CH3 Рахунок X', PaymentCurrencyRegisters: [{ Currency: uah }, { Currency: eur }] } as PaymentRegister

describe('income register selection (bank#6)', () => {
  it('keeps the register the user picked when the counterparty is chosen afterwards', () => {
    expect(keepPickedRegister([first, picked], 'r2', () => true)).toBe(picked)
  })

  it('drops the pick when it does not fit the new organization', () => {
    expect(keepPickedRegister([first, picked], 'r2', (register) => register !== picked)).toBeNull()
    expect(keepPickedRegister([first, picked], '', () => true)).toBeNull()
  })

  it('keeps the picked currency of the kept register', () => {
    expect(pickRegisterCurrency(picked, 'eur')).toBe(eur)
    expect(pickRegisterCurrency(picked, 'pln')).toBe(uah)
    expect(pickRegisterCurrency(null, 'eur')).toBeNull()
  })
})
