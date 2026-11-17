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

function toDayKey(value?: Date | string | null): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** «Діє з» after «Діє по»: the server rejects every later card save with such an agreement. */
export function isAgreementPeriodInverted(agreement: Pick<Agreement, 'FromDate' | 'ToDate'>): boolean {
  const from = toDayKey(agreement.FromDate)
  const to = toDayKey(agreement.ToDate)

  return Boolean(from && to && from > to)
}

/** The first agreement with an inverted period: the new-client wizard refuses to create it. */
export function findInvertedAgreement(clientAgreements: ClientAgreement[] | undefined): Agreement | null {
  return (clientAgreements || [])
    .map((clientAgreement) => clientAgreement.Agreement)
    .find((agreement): agreement is Agreement => Boolean(agreement) && isAgreementPeriodInverted(agreement as Agreement)) ?? null
}
