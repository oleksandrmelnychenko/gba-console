/** Informational documentary read overlay. Never used for payment or credit authorization. */
export type DocumentaryDebt = {
  DebtId: string
  ClientId: string | null
  AgreementId: string | null
  LocalAmount: number | null
  ScopeKnown: boolean
  ObligationDateBasis: string | null
  ObligationBusinessDay: string | null
  DueBusinessDay: string | null
  TermDays: number | null
  DebtAgeDays: number | null
  DaysPastDue: number | null
  AgingStatus: 'overdue' | 'due_today' | 'not_due' | 'unknown_date' | 'unknown_terms' | 'credit'
  AgingUnknownReason: string | null
}

export type DocumentaryAgreementDebt = {
  ClientId: string
  AgreementId: string
  CurrencyId: string | null
  PositiveDebtTotal: number | null
  CreditBalance: number | null
  KnownOverdueTotal: number
  KnownNotOverdueTotal: number
  UnknownDateDebtTotal: number
  UnknownTermsDebtTotal: number
  KnownOverdueCount: number
  KnownNotOverdueCount: number
  UnknownDateDebtCount: number
  UnknownTermsDebtCount: number
  UnknownScopeDebtCount: number
  HasCompleteAging: boolean
  OverdueTotal: number | null
  MaxKnownDebtAgeDays: number | null
  MaxKnownDaysPastDue: number | null
}

export type DocumentaryDebtAging = {
  Version: 1
  AsOfBusinessDay: string
  TermBasis: 'current_agreement'
  Debts: DocumentaryDebt[]
  Agreements: DocumentaryAgreementDebt[]
}

export type DocumentaryDebtSource = { DocumentaryDebtAging?: DocumentaryDebtAging | null }
type EntityId = number | string | null | undefined
export type DocumentaryAgreementScope = {
  ClientId?: EntityId
  AgreementId?: EntityId
  Client?: { Id?: EntityId } | null
  Agreement?: { Id?: EntityId } | null
}
export type DocumentaryDebtScope = {
  DebtId?: EntityId
  ClientId?: EntityId
  AgreementId?: EntityId
  Debt?: { Id?: EntityId; Days?: number | null } | null
  Client?: { Id?: EntityId } | null
  Agreement?: { Id?: EntityId } | null
}

export type DocumentaryDebtIndex = {
  present: boolean
  overlay: DocumentaryDebtAging | null
  debts: ReadonlyMap<string, DocumentaryDebt | null>
  agreements: ReadonlyMap<string, DocumentaryAgreementDebt | null>
}

export function documentaryIdentity(value: EntityId): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null
}

/** Presence, including explicit null, prevents legacy fallback. Never merge different snapshots. */
export function indexDocumentaryDebt(...sources: Array<DocumentaryDebtSource | null | undefined>): DocumentaryDebtIndex {
  const source = sources.find((item) => item?.DocumentaryDebtAging !== undefined)
  const candidate = source?.DocumentaryDebtAging
  const overlay = candidate?.Version === 1 && candidate.TermBasis === 'current_agreement'
    && Array.isArray(candidate.Debts) && Array.isArray(candidate.Agreements) ? candidate : null
  const debts = new Map<string, DocumentaryDebt | null>()
  const agreements = new Map<string, DocumentaryAgreementDebt | null>()
  for (const debt of overlay?.Debts ?? []) {
    const key = documentaryIdentity(debt.DebtId)
    if (key) debts.set(key, debts.has(key) ? null : debt)
  }
  for (const agreement of overlay?.Agreements ?? []) {
    const clientId = documentaryIdentity(agreement.ClientId)
    const agreementId = documentaryIdentity(agreement.AgreementId)
    if (!clientId || !agreementId) continue
    const key = `${clientId}:${agreementId}`
    agreements.set(key, agreements.has(key) ? null : agreement)
  }
  return { present: source !== undefined, overlay, debts, agreements }
}

function matchingIdentity(direct: EntityId, nested: EntityId): string | null {
  const first = documentaryIdentity(direct)
  const second = documentaryIdentity(nested)
  if (direct != null && first === null || nested != null && second === null) return null
  return first && second && first !== second ? null : first ?? second
}

export function findDocumentaryAgreement(index: DocumentaryDebtIndex, scope: DocumentaryAgreementScope): DocumentaryAgreementDebt | null {
  const clientId = matchingIdentity(scope.ClientId, scope.Client?.Id)
  const agreementId = matchingIdentity(scope.AgreementId, scope.Agreement?.Id)
  return clientId && agreementId ? index.agreements.get(`${clientId}:${agreementId}`) ?? null : null
}

export function findDocumentaryDebt(index: DocumentaryDebtIndex, scope: DocumentaryDebtScope): DocumentaryDebt | null {
  const id = matchingIdentity(scope.DebtId, scope.Debt?.Id)
  const debt = id ? index.debts.get(id) : null
  if (!debt || debt.ScopeKnown !== true || !documentaryIdentity(debt.ClientId) || !documentaryIdentity(debt.AgreementId)) return null
  const clientId = matchingIdentity(scope.ClientId, scope.Client?.Id)
  const agreementId = matchingIdentity(scope.AgreementId, scope.Agreement?.Id)
  if ((scope.ClientId != null || scope.Client?.Id != null) && clientId !== debt.ClientId) return null
  if ((scope.AgreementId != null || scope.Agreement?.Id != null) && agreementId !== debt.AgreementId) return null
  return debt
}

export function knownDocumentaryNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function documentaryDebtAge(index: DocumentaryDebtIndex, debt: DocumentaryDebtScope): number | null {
  if (!index.present) return knownDocumentaryNumber(debt.Debt?.Days)
  return knownDocumentaryNumber(findDocumentaryDebt(index, debt)?.DebtAgeDays)
}

export function documentaryAgreementPresentation(index: DocumentaryDebtIndex, scope: DocumentaryAgreementScope) {
  const summary = findDocumentaryAgreement(index, scope)
  const complete = summary?.HasCompleteAging === true
  const overdue = summary && summary.KnownOverdueCount > 0 ? true : complete ? false : null
  return {
    present: index.present,
    asOf: index.overlay?.AsOfBusinessDay,
    summary,
    complete,
    overdue,
    ageDays: knownDocumentaryNumber(summary?.MaxKnownDebtAgeDays),
    overdueDays: knownDocumentaryNumber(summary?.MaxKnownDaysPastDue),
    positiveDebt: knownDocumentaryNumber(summary?.PositiveDebtTotal),
    creditBalance: knownDocumentaryNumber(summary?.CreditBalance),
    knownOverdue: knownDocumentaryNumber(summary?.KnownOverdueTotal),
    unknownCount: summary ? summary.UnknownDateDebtCount + summary.UnknownTermsDebtCount + summary.UnknownScopeDebtCount : null,
  }
}

/** Remove only the informational member; preserve business identities and amounts. */
export function omitDocumentaryDebtAging<T extends object>(value: T): T {
  const result = { ...value }
  delete (result as DocumentaryDebtSource).DocumentaryDebtAging
  return result
}

/** Compact the read-enriched selection before it enters a sale or payment mutation snapshot. */
export function omitDocumentaryAgreementRead<T extends { Client?: object | null }>(agreement: T): T {
  const result = omitDocumentaryDebtAging(agreement)
  return { ...result, ...(result.Client ? { Client: omitDocumentaryDebtAging(result.Client) } : {}) }
}

/** A server business DATE is not a UTC instant. */
export function documentaryBusinessDate(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null
}
