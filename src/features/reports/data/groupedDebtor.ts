import { settlementPeriodExactGuid, settlementPeriodExactId, validSettlementPeriodDays } from './settlementPeriod'

export const GROUPED_DEBTOR_ROOT = '8AB2005056C0000811DEFC4535BB4D40'

export type GroupedDebtorCapability = {
  Available: boolean
  SourcePopulationCertified: boolean
  WorkbookParityVerified: boolean
  BuyerRootSourceId: typeof GROUPED_DEBTOR_ROOT
  MaximumDays: 31
  CurrencyBasis: 'SettlementCurrency'
  Reason: string
}

export type GroupedDebtorWitness = {
  AgreementId: string
  AgreementNetUid: string
  SourceAgreementRRef: string
  PublicationId: string
}

export type GroupedDebtorRow = {
  OrganizationId: string
  OrganizationNetUid: string
  OrganizationName: string
  CounterpartyId: string
  CounterpartyNetUid: string
  CounterpartyName: string
  CurrencyId: string
  CurrencyNetUid: string
  CurrencyCode: string
  Opening: string
  Incoming: string
  Outgoing: string
  Closing: string
  Agreements: GroupedDebtorWitness[]
}

export type GroupedDebtorStatement = {
  From: string
  To: string
  BuyerRootSourceId: typeof GROUPED_DEBTOR_ROOT
  Rows: GroupedDebtorRow[]
  CurrencyBasis: 'SettlementCurrency'
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).sort().join(',') === expected.sort().join(',')
const money = (value: unknown): value is string =>
  typeof value === 'string' && /^-?\d{1,27}(?:\.\d{1,2})?$/.test(value)
const cents = (value: string): bigint => {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return negative ? -amount : amount
}

export function readGroupedDebtorCapability(value: unknown): GroupedDebtorCapability | null {
  if (!object(value) || !fields(value, ['Available', 'SourcePopulationCertified', 'WorkbookParityVerified',
    'BuyerRootSourceId', 'MaximumDays', 'CurrencyBasis', 'Reason'])
    || typeof value.Available !== 'boolean' || typeof value.SourcePopulationCertified !== 'boolean'
    || typeof value.WorkbookParityVerified !== 'boolean'
    || value.BuyerRootSourceId !== GROUPED_DEBTOR_ROOT || value.MaximumDays !== 31
    || value.CurrencyBasis !== 'SettlementCurrency' || typeof value.Reason !== 'string'
    || (value.Available && (!value.SourcePopulationCertified || !value.WorkbookParityVerified))) return null
  return value as GroupedDebtorCapability
}

function readWitness(value: unknown): GroupedDebtorWitness | null {
  if (!object(value) || !fields(value, ['AgreementId', 'AgreementNetUid', 'SourceAgreementRRef', 'PublicationId'])
    || !settlementPeriodExactId(value.AgreementId)
    || !settlementPeriodExactGuid(value.AgreementNetUid)
    || typeof value.SourceAgreementRRef !== 'string'
    || !/^[0-9A-F]{32}$/.test(value.SourceAgreementRRef)
    || !settlementPeriodExactGuid(value.PublicationId)) return null
  return value as GroupedDebtorWitness
}

function readRow(value: unknown): GroupedDebtorRow | null {
  if (!object(value) || !fields(value, ['OrganizationId', 'OrganizationNetUid', 'OrganizationName',
    'CounterpartyId', 'CounterpartyNetUid', 'CounterpartyName', 'CurrencyId', 'CurrencyNetUid',
    'CurrencyCode', 'Opening', 'Incoming', 'Outgoing', 'Closing', 'Agreements'])
    || !settlementPeriodExactId(value.OrganizationId) || !settlementPeriodExactGuid(value.OrganizationNetUid)
    || !settlementPeriodExactId(value.CounterpartyId) || !settlementPeriodExactGuid(value.CounterpartyNetUid)
    || !settlementPeriodExactId(value.CurrencyId) || !settlementPeriodExactGuid(value.CurrencyNetUid)
    || typeof value.OrganizationName !== 'string' || !value.OrganizationName.trim()
    || typeof value.CounterpartyName !== 'string' || !value.CounterpartyName.trim()
    || typeof value.CurrencyCode !== 'string' || !/^\d{3}$/.test(value.CurrencyCode) || value.CurrencyCode === '000'
    || !money(value.Opening) || !money(value.Incoming) || !money(value.Outgoing) || !money(value.Closing)
    || cents(value.Opening) + cents(value.Incoming) - cents(value.Outgoing) !== cents(value.Closing)
    || !Array.isArray(value.Agreements) || value.Agreements.length === 0 || value.Agreements.length > 12000
    || value.Agreements.some(item => !readWitness(item))) return null
  const witnesses = value.Agreements as GroupedDebtorWitness[]
  if (new Set(witnesses.map(item => item.PublicationId)).size !== witnesses.length) return null
  return value as GroupedDebtorRow
}

export function readGroupedDebtorStatement(value: unknown, from: string, to: string): GroupedDebtorStatement | null {
  if (!object(value) || !fields(value, ['From', 'To', 'BuyerRootSourceId', 'Rows', 'CurrencyBasis'])
    || value.From !== from || value.To !== to || value.BuyerRootSourceId !== GROUPED_DEBTOR_ROOT
    || value.CurrencyBasis !== 'SettlementCurrency' || !validSettlementPeriodDays(from, to)
    || !Array.isArray(value.Rows) || value.Rows.length > 12000
    || value.Rows.some(row => !readRow(row))) return null
  const rows = value.Rows as GroupedDebtorRow[]
  const keys = rows.map(row => [row.OrganizationId, row.OrganizationNetUid, row.CounterpartyId,
    row.CounterpartyNetUid, row.CurrencyId, row.CurrencyNetUid].join(':'))
  return new Set(keys).size === keys.length ? value as GroupedDebtorStatement : null
}

export function formatGroupedDebtorMoney(value: string): string {
  const amount = cents(value)
  const negative = amount < 0n
  const absolute = negative ? -amount : amount
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${negative ? '−' : ''}${whole},${(absolute % 100n).toString().padStart(2, '0')}`
}
