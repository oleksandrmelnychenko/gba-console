import { describe, expect, it } from 'vitest'
import type { ClientBankDetails } from '../../types'
import {
  bankDetailsWereDropped,
  isValidAccountNumber,
  isValidIban,
  isValidSwift,
  prepareBankDetailsForSave,
  validateBankDetails,
} from './bankDetailsValidation'

const t = (value: string) => value
const UAH = { Id: 1, Name: 'Гривня' }

describe('bank details formats', () => {
  it('checks IBAN shape and checksum, SWIFT and account number', () => {
    expect(isValidIban('UA21 3223 1300 0002 6007 2335 6600 1')).toBe(true)
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('UA213223130000026007233566002')).toBe(false)
    expect(isValidIban('abc')).toBe(false)
    expect(isValidSwift('PBANUA2X')).toBe(true)
    expect(isValidSwift('PBANUA2XKIE')).toBe(true)
    expect(isValidSwift('!!')).toBe(false)
    expect(isValidAccountNumber('26007233566001')).toBe(true)
    expect(isValidAccountNumber('рахунок')).toBe(false)
  })

  it('reports each bad field and a missing currency', () => {
    const errors = validateBankDetails({
      AccountNumber: { AccountNumber: 'рахунок' },
      ClientBankDetailIbanNo: { IBANNO: 'abc' },
      Swift: '!!',
    }, t)

    expect(Object.keys(errors).sort()).toEqual([
      'BankAccountCurrency', 'BankAccountNumber', 'BankIban', 'BankIbanCurrency', 'BankSwift',
    ])
  })

  it('accepts valid details and leaves an untouched legacy IBAN alone', () => {
    const valid: ClientBankDetails = {
      AccountNumber: { AccountNumber: '26007233566001', Currency: UAH },
      ClientBankDetailIbanNo: { IBANNO: 'UA213223130000026007233566001', Currency: UAH },
      Swift: 'PBANUA2X',
    }
    expect(validateBankDetails(valid, t)).toEqual({})

    const legacy: ClientBankDetails = { Id: 5, ClientBankDetailIbanNo: { Id: 6, IBANNO: '1C-legacy', Currency: UAH } }
    expect(validateBankDetails(legacy, t, legacy)).toEqual({})
  })
})

describe('bank details payload', () => {
  it('drops empty new entries and a wholly empty new record', () => {
    expect(prepareBankDetailsForSave({
      AccountNumber: { Currency: UAH },
      ClientBankDetailIbanNo: { Currency: UAH },
    })).toBeUndefined()
    expect(prepareBankDetailsForSave({
      AccountNumber: { Currency: UAH },
      ClientBankDetailIbanNo: { IBANNO: 'UA213223130000026007233566001', Currency: UAH },
    })).toEqual({ ClientBankDetailIbanNo: { IBANNO: 'UA213223130000026007233566001', Currency: UAH } })
  })

  it('notices when the server answered without the details that were sent', () => {
    expect(bankDetailsWereDropped({ BankAndBranch: 'QA Банк' }, null)).toBe(true)
    expect(bankDetailsWereDropped({ BankAndBranch: 'QA Банк' }, { BankAndBranch: 'QA Банк' })).toBe(false)
    expect(bankDetailsWereDropped(undefined, null)).toBe(false)
  })
})
