import { createCashMovementRequest, isCashMovementArticleCaption, isCashMovementOpaqueKey,
  type CashMovementCapabilities, type CashMovementIdentity } from './cashMovement'

export type CashMovementArticleChoicesRequest = { Version: 1; SourceIdentity: CashMovementIdentity; Period: string; ContinuationKey: string | null }
export type CashMovementArticleChoice = { Key: string; Caption: string }
export type CashMovementArticleChoices = CashMovementArticleChoicesRequest & { Available: boolean; Code: string; Choices: CashMovementArticleChoice[]
  SelectionPolicy: 'AllPublishedCatalogueEntriesWithoutNativeVisibilityFiltering'; NativeChoiceVisibilityVerified: false; SourceParityVerified: false }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export function invalidCashMovementChoices() { return new Error('Сервер повернув непідтверджений список статей для цієї форми та періоду.') }
export function createCashMovementArticleChoicesRequest(capability: CashMovementCapabilities, period: string,
  continuationKey: string | null = null): CashMovementArticleChoicesRequest {
  const request = createCashMovementRequest(capability, period)
  if (continuationKey !== null && !isCashMovementOpaqueKey(continuationKey)) throw invalidCashMovementChoices()
  return { ...request, ContinuationKey: continuationKey }
}
export function normalizeCashMovementArticleChoices(value: unknown, request: CashMovementArticleChoicesRequest): CashMovementArticleChoices {
  if (!record(value) || !exactKeys(value, ['Version', 'SourceIdentity', 'Period', 'Available', 'Code', 'Choices', 'ContinuationKey',
    'SelectionPolicy', 'NativeChoiceVisibilityVerified', 'SourceParityVerified']) || value.Version !== request.Version
    || !record(value.SourceIdentity) || !exactKeys(value.SourceIdentity, Object.keys(request.SourceIdentity))
    || !Object.entries(request.SourceIdentity).every(([key, expected]) => (value.SourceIdentity as Record<string, unknown>)[key] === expected)
    || value.Period !== request.Period || typeof value.Available !== 'boolean'
    || typeof value.Code !== 'string' || value.Code.length === 0 || value.Code.length > 2048 || value.Code.trim() !== value.Code
    || !Array.isArray(value.Choices) || value.Choices.length > 256 || !(value.ContinuationKey === null || isCashMovementOpaqueKey(value.ContinuationKey))
    || !value.Available && (value.Choices.length !== 0 || value.ContinuationKey !== null)
    || value.SelectionPolicy !== 'AllPublishedCatalogueEntriesWithoutNativeVisibilityFiltering'
    || value.NativeChoiceVisibilityVerified !== false || value.SourceParityVerified !== false) throw invalidCashMovementChoices()
  const keys = new Set<string>()
  for (const choice of value.Choices) {
    if (!record(choice) || !exactKeys(choice, ['Key', 'Caption']) || !isCashMovementOpaqueKey(choice.Key)
      || !isCashMovementArticleCaption(choice.Caption) || keys.has(choice.Key)) throw invalidCashMovementChoices()
    keys.add(choice.Key)
  }
  return value as unknown as CashMovementArticleChoices
}
