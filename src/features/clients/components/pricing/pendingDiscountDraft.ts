import type { Client } from '../../types'
import type { DiscountsTreeDraft } from './DiscountsTree'

export function applyPendingDiscountDraft(client: Client, draft: DiscountsTreeDraft | null): Client {
  if (!draft?.isDirty || !draft.clientAgreementNetId) {
    return client
  }

  return {
    ...client,
    ClientAgreements: (client.ClientAgreements || []).map((clientAgreement) =>
      clientAgreement.Agreement?.NetUid === draft.clientAgreementNetId
        ? { ...clientAgreement, ProductGroupDiscounts: draft.productGroupDiscounts }
        : clientAgreement,
    ),
  }
}
