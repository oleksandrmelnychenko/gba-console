import type { ClientCommercialStructure, ClientSourceAgreementSnapshot } from '../../types'

export type BuyerPriceTypeRow = {
  reference: string
  agreement: string
  standard: string
  promotional: string | null
  validity: string
}

export type BuyerPriceTypeEvidence = {
  state: 'ready' | 'unavailable' | 'incomplete'
  reason: string
  capturedAt: string | null
  rows: BuyerPriceTypeRow[]
}

const buyerKinds = new Set(['WithBuyer', 'WithCommissionAgent'])
const otherKinds = new Set(['WithSupplier', 'WithPrincipal', 'Barter', 'Other'])

function unavailable(reason: string, state: BuyerPriceTypeEvidence['state'] = 'incomplete'): BuyerPriceTypeEvidence {
  return { state, reason, capturedAt: null, rows: [] }
}

function utcDay(value: string | null | undefined): number | null {
  if (!value) return null
  // The server serializes UTC DateTime values, sometimes without a trailing Z.
  // Validate the entire value before using its calendar day as a business date.
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(?:Z|\+00:00)?)?$/.exec(value.trim())
  if (!match) return null
  if (match[2] && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59)) return null
  const day = new Date(`${match[1]}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(match[1])
    ? day.getTime()
    : null
}

function agreementValidity(agreement: ClientSourceAgreementSnapshot, asOfDay: number): 'current' | 'retained' | 'outside' | 'invalid' {
  if (agreement.FromDate && utcDay(agreement.FromDate) === null) return 'invalid'
  if (agreement.ToDate && utcDay(agreement.ToDate) === null) return 'invalid'
  const from = utcDay(agreement.FromDate)
  const to = utcDay(agreement.ToDate)
  if (from !== null && to !== null && from > to) return 'invalid'
  if (from !== null && from > asOfDay || to !== null && to < asOfDay) return 'outside'
  return from === null && to === null ? 'retained' : 'current'
}

// A separate local evidence list. The retained native 1C constructor has no
// dataset or filter definition, so these rows do not claim native parity.
export function selectBuyerPriceTypeEvidence(structure: ClientCommercialStructure): BuyerPriceTypeEvidence {
  const targets = structure.LegalParties.flatMap((party) => party.Cards)
    .filter((card) => card.IsTarget && card.ClientNetUid === structure.ClientNetUid)
  if (targets.length !== 1) return unavailable('Немає однозначної відкритої картки клієнта.')

  const fenix = targets[0].SourceSnapshots.filter((snapshot) => snapshot.SourceSystem === 'fenix')
  if (fenix.length === 0) return unavailable('Для картки ще немає зрізу Fenix.', 'unavailable')
  if (fenix.length !== 1) return unavailable('Для картки є кілька зрізів Fenix.')
  const snapshot = fenix[0]
  if (!snapshot.SourceIdentityValid || snapshot.EvidenceTruncated || snapshot.SourceMarkedDeleted) {
    return unavailable('Зріз Fenix неповний, пошкоджений або позначений видаленим.')
  }
  if (snapshot.Buyer === undefined) return unavailable('Ознака покупця ще не доступна в цьому зрізі.')
  if (!snapshot.Buyer) return unavailable('Картку не позначено покупцем у Fenix.', 'unavailable')

  const asOfDay = utcDay(snapshot.LastSeenAtUtc)
  if (asOfDay === null || !Array.isArray(snapshot.Agreements)) {
    return unavailable('Немає надійної дати або договорів у зрізі Fenix.')
  }

  const rows: BuyerPriceTypeRow[] = []
  const references = new Set<string>()
  for (const agreement of snapshot.Agreements) {
    const kind = agreement.AgreementType?.trim()
    if (otherKinds.has(kind ?? '')) continue
    if (!buyerKinds.has(kind ?? '')) return unavailable('Тип одного з договорів Fenix не визначено.')
    if (agreement.SourceMarkedDeleted) continue
    const validity = agreementValidity(agreement, asOfDay)
    if (validity === 'invalid') return unavailable('Дати одного з договорів Fenix некоректні.')
    if (validity === 'outside') continue

    const reference = agreement.SourceReference?.trim().toUpperCase() ?? ''
    const standard = agreement.TypePriceName?.trim() ?? ''
    if (!/^[0-9A-F]{32}$/.test(reference) || /^0+$/.test(reference) || references.has(reference)) {
      return unavailable('Немає однозначного ідентифікатора чинного договору Fenix.')
    }
    if (!standard) return unavailable('У чинному договорі покупця відсутній стандартний тип ціни.')
    references.add(reference)
    rows.push({
      reference,
      agreement: agreement.Name?.trim() || agreement.Number?.trim() || `№ ${agreement.SourceCode}`,
      standard,
      promotional: agreement.PromotionalTypePriceName?.trim() || null,
      validity: validity === 'current' ? 'Чинний на дату синку' : 'Без зазначеного строку',
    })
  }

  rows.sort((left, right) => left.agreement.localeCompare(right.agreement, 'uk') || left.reference.localeCompare(right.reference))
  return { state: 'ready', reason: '', capturedAt: snapshot.LastSeenAtUtc, rows }
}
