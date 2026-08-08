import type { Agreement, ClientAgreement } from '../../types'

export type NewClientAgreementDraft = {
  agreement: Agreement
  clientAgreements: ClientAgreement[]
}

export function appendNewClientAgreementDraft(
  clientAgreements: ClientAgreement[],
  agreement: Agreement,
): NewClientAgreementDraft {
  const savedAgreement = { ...agreement }
  delete savedAgreement.NetUid
  savedAgreement.TempId = nextTempId(clientAgreements)

  return {
    agreement: savedAgreement,
    clientAgreements: [
      ...clientAgreements,
      { Agreement: savedAgreement },
    ],
  }
}

function nextTempId(clientAgreements: ClientAgreement[]): number {
  const used = clientAgreements
    .map((clientAgreement) => clientAgreement.Agreement?.TempId)
    .filter((value): value is number => typeof value === 'number')

  return (used.length ? Math.max(...used) : 0) + 1
}
