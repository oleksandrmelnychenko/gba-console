/* Owner decision: no NEW operation (sale, offer, income or outgoing payment,
   sale return) may be made against an inactive agreement; the server answers
   «Договір неактивний — операції за ним заборонені.». Pickers that start a new
   operation therefore offer only active agreements. History and detail views
   keep showing inactive ones. A payload that does not carry the flag is kept
   (the server still refuses), so a missing field never empties a picker. */
export const INACTIVE_AGREEMENT_MESSAGE = 'Договір неактивний — операції за ним заборонені.'

export function isAgreementOpenForNewOperations(clientAgreement: object | null | undefined): boolean {
  const agreement = (clientAgreement as { Agreement?: { IsActive?: unknown } | null } | null | undefined)?.Agreement

  return agreement?.IsActive !== false
}

/** Agreements a new operation may use. `keep` retains one already chosen by an existing document. */
export function agreementsForNewOperation<T extends object>(
  agreements: readonly T[],
  keep?: (agreement: T) => boolean,
): T[] {
  return agreements.filter((agreement) => isAgreementOpenForNewOperations(agreement) || Boolean(keep?.(agreement)))
}
