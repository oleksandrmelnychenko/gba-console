import type { PayablesAmounts, PayablesBucket, PayablesRows, PayablesSelection } from '../payablesTypes'

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const time = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })

export const formatPayablesAmount = (value: number) => money.format(value)
export const formatPayablesTime = (value: string) => `${time.format(new Date(value))} (Київ)`
export const payablesCurrencyLabel = (bucket: PayablesBucket) => bucket.currencyLabel && bucket.currencyLabel !== bucket.currencyCode ? `${bucket.currencyLabel} (${bucket.currencyCode})` : bucket.currencyCode
export const payablesScopeLabel = (scope: string) => scope === 'registered-canonical-supplier-agreements' ? 'Зареєстровані договори постачальників за організацією та валютою' : scope

function sameAmounts(left: PayablesAmounts, right: PayablesAmounts) {
  return left.signedBalance === right.signedBalance && left.payable === right.payable && left.advance === right.advance
}

export function matchesPayablesSelection(data: PayablesRows, selected: PayablesSelection) {
  return data.world === selected.world.world && data.publicationId === selected.world.publicationId
    && data.currencyCode === selected.bucket.currencyCode && data.total === selected.bucket.rowCount
    && Date.parse(data.sourceCutoffUtc) === Date.parse(selected.world.sourceCutoffUtc ?? '')
    && sameAmounts(data.aggregate, selected.bucket)
}
