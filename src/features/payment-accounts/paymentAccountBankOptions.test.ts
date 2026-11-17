import { describe, expect, it } from 'vitest'
import { toBankOptions } from './paymentAccountBankOptions'

describe('payment account «Банк» options', () => {
  it('keeps the stored bank name selectable after that bank was deleted', () => {
    expect(toBankOptions([{ Name: 'QA Банк' }], 'CH3 Банк X')).toEqual([
      { label: 'QA Банк', value: 'QA Банк' },
      { label: 'CH3 Банк X (банк видалено)', value: 'CH3 Банк X' },
    ])
  })

  it('lists each bank name once and adds nothing for a known or empty stored name', () => {
    expect(toBankOptions([{ Name: 'QA Банк' }, { Name: 'QA Банк' }], 'QA Банк')).toEqual([{ label: 'QA Банк', value: 'QA Банк' }])
    expect(toBankOptions([], '')).toEqual([])
  })
})
