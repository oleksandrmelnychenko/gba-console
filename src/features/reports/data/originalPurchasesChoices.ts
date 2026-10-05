import { isPurchasesHumanCaption, PURCHASES_DEFINITION, PURCHASES_SOURCE, purchasesFilters, purchasesSelectors, validatePurchasesRequest, type PurchasesField, type PurchasesRequest } from './originalPurchases'

export type PurchasesSelections = Record<PurchasesField, string[]>
export type PurchasesChoice = { Field: PurchasesField; Type: '08' | 'Enum'; TableReference: string; Key: string; Caption: string; Deleted: boolean }
export type PurchasesChoices = {
  Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Selectors: PurchasesSelections; Measures: PurchasesRequest['Measures']; FieldAvailability: Record<PurchasesField, boolean>;
  Choices: Record<PurchasesField, PurchasesChoice[]>; FieldWitnessSha256: Partial<Record<PurchasesField, string>>;
  MissingFamilies: PurchasesField[]; OurSnapshotVerified: boolean; ResultSha256: string;
  HumanChoicesAvailable: boolean; SourceParityVerified: false; OriginalFullTaskAccepted: false
}
const tables: Record<PurchasesField, readonly string[]> = {
  СтатусПартии: ['_Enum566'], Контрагент: ['00000044'], Номенклатура: ['00000054'], Подразделение: ['00000061'], Проект: ['0000001F', '00000069'],
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, expected: readonly string[]) => Array.isArray(value) && value.length === expected.length && value.every((x, i) => x === expected[i])
const digest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) && !/^0+$/.test(value)
const fields = (value: unknown): value is Record<PurchasesField, unknown> => object(value) && exact(Object.keys(value).sort(), [...purchasesFilters].sort())
export const emptyPurchasesSelections = (): PurchasesSelections => ({ СтатусПартии: [], Контрагент: [], Номенклатура: [], Подразделение: [], Проект: [] })
function choices(input: unknown, field: PurchasesField): input is PurchasesChoice[] {
  if (!Array.isArray(input)) return false
  const keys = new Set<string>(), allowedTables = new Set(tables[field])
  return input.every(row => {
    if (!object(row) || row.Field !== field || row.Type !== (field === 'СтатусПартии' ? 'Enum' : '08') || typeof row.TableReference !== 'string' || !allowedTables.has(row.TableReference)
      || typeof row.Key !== 'string' || !isPurchasesHumanCaption(row.Caption) || typeof row.Deleted !== 'boolean'
      || !/^[0-9A-F]{32}$/.test(field === 'Проект' ? row.Key.slice(12) : row.Key)
      || field === 'Проект' && !row.Key.startsWith(`08:${row.TableReference}:`) || keys.has(row.Key)
      || field === 'СтатусПартии' && (row.Deleted !== false || /^0+$/.test(row.Key))) return false
    keys.add(row.Key); return true
  })
}
/** Each field needs its current witness; Status additionally needs all nine names from the server's admitted enum mapping. */
export function normalizePurchasesChoices(value: unknown, request: PurchasesRequest): PurchasesChoices {
  const scope = validatePurchasesRequest(request), selectors = purchasesSelectors(scope)
  const fail = () => { throw new Error('Сервер не підтвердив назви для поточного періоду закупівель.') }
  if (!object(value) || value.Version !== 1 || value.World !== 'fenix' || value.SourceId !== PURCHASES_SOURCE || value.DefinitionSha256 !== PURCHASES_DEFINITION
    || value.From !== scope.From || value.Through !== scope.Through || !fields(value.Selectors) || !fields(value.FieldAvailability) || !fields(value.Choices)
    || !exact(value.Measures, scope.Measures) || !object(value.FieldWitnessSha256) || !Array.isArray(value.MissingFamilies)
    || typeof value.OurSnapshotVerified !== 'boolean' || !digest(value.ResultSha256) || typeof value.HumanChoicesAvailable !== 'boolean'
    || value.SourceParityVerified !== false || value.OriginalFullTaskAccepted !== false) return fail()
  const availability = value.FieldAvailability, offered = value.Choices, witnesses = value.FieldWitnessSha256, echo = value.Selectors
  const missing = purchasesFilters.filter(field => !availability[field])
  if (value.HumanChoicesAvailable !== (value.OurSnapshotVerified && missing.length === 0) || !exact([...value.MissingFamilies].sort(), [...missing].sort())
    || !exact(Object.keys(witnesses).sort(), purchasesFilters.filter(field => availability[field]).sort())
    || !purchasesFilters.every(field => typeof availability[field] === 'boolean' && exact(echo[field], selectors[field]) && choices(offered[field], field)
      && (availability[field] ? value.OurSnapshotVerified === true && digest(witnesses[field])
        && (field !== 'СтатусПартии' || (offered[field] as unknown[]).length === 9) : (offered[field] as unknown[]).length === 0))) return fail()
  return structuredClone(value) as PurchasesChoices
}
/** Uses canonical period-wide names; report selectors never shrink catalogue coverage or invent a missing option. */
export function purchasesNamedRequest(request: PurchasesRequest, selection: PurchasesSelections, named: PurchasesChoices | null): PurchasesRequest {
  const scope = validatePurchasesRequest(request), any = purchasesFilters.some(field => selection[field].length)
  if (!any) return scope
  if (!named || !named.OurSnapshotVerified || named.From !== scope.From || named.Through !== scope.Through
    || named.World !== scope.World || named.SourceId !== scope.SourceId || named.DefinitionSha256 !== scope.DefinitionSha256
    || purchasesFilters.some(field => named.Selectors[field].length)) throw new Error('Завантажте актуальні назви для вибраного періоду.')
  const witnesses: Partial<Record<PurchasesField, string>> = {}
  for (const field of purchasesFilters) {
    if (!selection[field].length) continue
    if (!named.FieldAvailability[field] || !named.FieldWitnessSha256[field]
      || selection[field].some(key => !named.Choices[field].some(choice => choice.Key === key))) throw new Error('Вибраний відбір більше не підтверджено. Оновіть назви.')
    witnesses[field] = named.FieldWitnessSha256[field]
  }
  return validatePurchasesRequest({ ...scope, Statuses: selection.СтатусПартии, Counterparties: selection.Контрагент,
    Products: selection.Номенклатура, Divisions: selection.Подразделение, Projects: selection.Проект, NamedChoiceWitnesses: witnesses })
}
