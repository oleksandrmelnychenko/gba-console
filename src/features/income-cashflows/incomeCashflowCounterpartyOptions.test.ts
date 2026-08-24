import { describe, expect, it } from 'vitest'
import type { Client } from './types'
import {
  findIncomeCashflowCounterpartyByOption,
  getIncomeCashflowCounterpartyLabel,
  getIncomeCashflowCounterpartyOptions,
  getIncomeCashflowCounterpartySearchValue,
} from './incomeCashflowCounterpartyOptions'

describe('income cashflow counterparty options', () => {
  it('keeps a region-code search result visible and selects the exact same-name client', () => {
    const firstClient: Client = {
      FullName: 'ТОВ «АФ-ТРАНС»',
      NetUid: 'client-ce02501',
      RegionCode: { Value: ' CE02501 ' },
    }
    const secondClient: Client = {
      FullName: 'ТОВ «АФ-ТРАНС»',
      NetUid: 'client-ce02502',
      RegionCode: { Value: 'CE02502' },
    }

    expect(getIncomeCashflowCounterpartyOptions([
      firstClient,
      secondClient,
    ])).toEqual([
      'CE02501 · ТОВ «АФ-ТРАНС»',
      'CE02502 · ТОВ «АФ-ТРАНС»',
    ])
    expect(findIncomeCashflowCounterpartyByOption(
      [firstClient, secondClient],
      'CE02502 · ТОВ «АФ-ТРАНС»',
    )).toBe(secondClient)
    expect(getIncomeCashflowCounterpartySearchValue(
      [firstClient, secondClient],
      'CE02502 · ТОВ «АФ-ТРАНС»',
    )).toBe('CE02502')
  })

  it('preserves the existing name label when a counterparty has no region code', () => {
    expect(getIncomeCashflowCounterpartyLabel({
      FullName: 'Клієнт без коду',
      NetUid: 'client-without-code',
    })).toBe('Клієнт без коду')
    expect(getIncomeCashflowCounterpartySearchValue([], '  Клієнт  ')).toBe('Клієнт')
  })
})
