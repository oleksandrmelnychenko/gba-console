import { describe, expect, it } from 'vitest'
import { getPaymentPurposeSuggestionScope } from './paymentPurposeSuggestionScope'

describe('getPaymentPurposeSuggestionScope', () => {
  it('returns the resolved client and agreement scope when the selected label still matches', () => {
    expect(
      getPaymentPurposeSuggestionScope({
        clientAgreementNetId: 'agreement-1',
        clientNetId: 'client-1',
        counterpartySearch: ' Конкорд ',
        selectedClientName: 'Конкорд',
      }),
    ).toEqual({ clientAgreementNetId: 'agreement-1', clientNetId: 'client-1' })
  })

  it('hides the old scope while another counterparty is being entered', () => {
    expect(
      getPaymentPurposeSuggestionScope({
        clientAgreementNetId: 'agreement-1',
        clientNetId: 'client-1',
        counterpartySearch: 'Інший клієнт',
        selectedClientName: 'Конкорд',
      }),
    ).toEqual({})
  })

  it('requires both the client and its agreement', () => {
    expect(
      getPaymentPurposeSuggestionScope({
        clientNetId: 'client-1',
        counterpartySearch: 'Конкорд',
        selectedClientName: 'Конкорд',
      }),
    ).toEqual({})
  })
})
