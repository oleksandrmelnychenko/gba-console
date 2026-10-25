import { omitDocumentaryAgreementRead, omitDocumentaryDebtAging } from '../../shared/debt/documentaryDebtAging'
import type { Client, ClientAgreement } from './types'

export function paymentAgreementWithoutDocumentaryRead(agreement: ClientAgreement): ClientAgreement {
  return omitDocumentaryAgreementRead(agreement)
}

export function paymentClientWithoutDocumentaryRead(client: Client): Client {
  const result = omitDocumentaryDebtAging(client)
  return {
    ...result,
    ...(result.ClientAgreements ? { ClientAgreements: result.ClientAgreements.map(paymentAgreementWithoutDocumentaryRead) } : {}),
  }
}
