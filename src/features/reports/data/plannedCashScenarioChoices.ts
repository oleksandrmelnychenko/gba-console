import { invalidPlannedCash, isPlannedCashCapabilities, isPlannedCashOpaqueKey, plannedCashPeriodFilterError,
  type PlannedCashCapabilities, type PlannedCashFilters, type PlannedCashIdentity, type PlannedCashPeriod } from './plannedCash'

export type PlannedCashScenarioChoicesRequest = { Version: 1; SourceIdentity: PlannedCashIdentity; CurrentPeriod: PlannedCashPeriod
  PreviousPeriod: PlannedCashPeriod; ContinuationKey: string | null }
export type PlannedCashScenarioChoice = { Key: string; Caption: string }
export type PlannedCashScenarioChoices = PlannedCashScenarioChoicesRequest & { Available: boolean; Code: string; Choices: PlannedCashScenarioChoice[]
  SelectionPolicy: 'AllPublishedCatalogueEntriesWithoutNativeVisibilityFiltering'; NativeChoiceVisibilityVerified: false
  NativeChoiceDefaultVerified: false; SourceParityVerified: false }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) }
function matchingObject(value: unknown, expected: object) { return record(value) && exactKeys(value, Object.keys(expected))
  && Object.entries(expected).every(([key, item]) => value[key] === item) }
/** Native labels remain lossless; malformed UTF16 and nameless entries cannot become selectable choices. */
function caption(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100 || /^\p{White_Space}*$/u.test(value)) return false
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdbff) { const low = value.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) return false }
    else if (unit >= 0xdc00 && unit <= 0xdfff) return false
  }
  return true
}
export function createPlannedCashScenarioChoicesRequest(capability: PlannedCashCapabilities, filters: PlannedCashFilters,
  continuationKey: string | null = null): PlannedCashScenarioChoicesRequest {
  if (!isPlannedCashCapabilities(capability) || !capability.RuntimeImplemented || !capability.ScenarioChoiceApiImplemented) throw invalidPlannedCash()
  const error = plannedCashPeriodFilterError(capability, filters); if (error) throw new Error(error)
  if (continuationKey !== null && !isPlannedCashOpaqueKey(continuationKey)) throw invalidPlannedCash()
  return { Version: capability.Version, SourceIdentity: { ...capability.SourceIdentity },
    CurrentPeriod: { From: `${filters.From}T00:00:00.000`, ThroughExclusive: `${filters.ThroughExclusive}T00:00:00.000` },
    PreviousPeriod: { From: `${filters.PreviousFrom}T00:00:00.000`, ThroughExclusive: `${filters.PreviousThroughExclusive}T00:00:00.000` }, ContinuationKey: continuationKey }
}
export function normalizePlannedCashScenarioChoices(value: unknown, request: PlannedCashScenarioChoicesRequest): PlannedCashScenarioChoices {
  if (!record(value) || !exactKeys(value, ['Version', 'SourceIdentity', 'CurrentPeriod', 'PreviousPeriod', 'Available', 'Code', 'Choices', 'ContinuationKey',
    'SelectionPolicy', 'NativeChoiceVisibilityVerified', 'NativeChoiceDefaultVerified', 'SourceParityVerified']) || value.Version !== request.Version
    || !matchingObject(value.SourceIdentity, request.SourceIdentity) || !matchingObject(value.CurrentPeriod, request.CurrentPeriod)
    || !matchingObject(value.PreviousPeriod, request.PreviousPeriod) || typeof value.Available !== 'boolean'
    || typeof value.Code !== 'string' || value.Code.length === 0 || value.Code.length > 2048 || value.Code.trim() !== value.Code
    || !Array.isArray(value.Choices) || value.Choices.length > 256 || !(value.ContinuationKey === null || isPlannedCashOpaqueKey(value.ContinuationKey))
    || !value.Available && (value.Choices.length !== 0 || value.ContinuationKey !== null)
    || value.SelectionPolicy !== 'AllPublishedCatalogueEntriesWithoutNativeVisibilityFiltering' || value.NativeChoiceVisibilityVerified !== false
    || value.NativeChoiceDefaultVerified !== false || value.SourceParityVerified !== false) throw invalidPlannedCash()
  const keys = new Set<string>()
  for (const choice of value.Choices) {
    if (!record(choice) || !exactKeys(choice, ['Key', 'Caption']) || !isPlannedCashOpaqueKey(choice.Key) || !caption(choice.Caption) || keys.has(choice.Key)) throw invalidPlannedCash()
    keys.add(choice.Key)
  }
  return value as unknown as PlannedCashScenarioChoices
}
