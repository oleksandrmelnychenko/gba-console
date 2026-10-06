import { emptyFenixSelection, fenixDiscountFields, fenixDiscountRequest, fenixRecipientKey, isFenixDiscountChoice, validateFenixDiscountRequest,
  type FenixDiscountChoice, type FenixDiscountChoices, type FenixDiscountField, type FenixDiscountRequest, type FenixDiscountSelection } from './originalFenixClientDiscounts'
export type FenixDiscountCatalogue = Omit<FenixDiscountChoices, 'Choices'> & { Counts: Record<FenixDiscountField, number> }
export type FenixDiscountChoicePageRequest = { Scope: FenixDiscountRequest; Field: FenixDiscountField; Search: string; Offset: number; Limit: number; InputWitnessSha256: string; ChoicesWitnessSha256: string; SelectedKeys: string[] }
export type FenixDiscountChoicePage = { Catalogue: FenixDiscountCatalogue; Field: FenixDiscountField; Search: string; Offset: number; Limit: number; Total: number; NextOffset: number | null; SelectedKeys: string[]; Items: FenixDiscountChoice[]; SelectedChoices: FenixDiscountChoice[]; ResultSha256: string }
export type FenixSelectedCaptions = Record<FenixDiscountField, FenixDiscountChoice[]>
export const emptyFenixCaptions = (): FenixSelectedCaptions => ({ Номенклатура: [], ПолучательСкидки: [], КодПоРегиону: [] })
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const integer = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max
function utf16(v: string) {
  for (let i = 0; i < v.length; i++) { const c = v.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) { const low = v.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) return false }
    else if (c >= 0xdc00 && c <= 0xdfff) return false
  }
  return true
}
const fail = (): never => { throw new Error('Сервер не підтвердив сторінку актуальних назв FENIX.') }
export function normalizeFenixChoiceCatalogue(v: unknown, request: FenixDiscountRequest): FenixDiscountCatalogue {
  const scope = validateFenixDiscountRequest(request)
  if (!object(v) || v.Version !== scope.Version || v.World !== scope.World || v.SourceId !== scope.SourceId || v.DefinitionSha256 !== scope.DefinitionSha256 || v.Through !== scope.Through
    || !same(v.RequestedProducts, scope.Products) || !same(v.RequestedRecipients, scope.Recipients) || !same(v.RequestedRegionCodes, scope.RegionCodes)
    || !object(v.FieldAvailability) || !object(v.Counts) || !same(Object.keys(v.FieldAvailability).sort(), [...fenixDiscountFields].sort()) || !same(Object.keys(v.Counts).sort(), [...fenixDiscountFields].sort())
    || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || !digest(v.ResultSha256)
    || !(v.Dependency === null || typeof v.Dependency === 'string' && /^[a-z][a-z0-9_]{0,200}$/.test(v.Dependency))
    || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256)) || !(v.ChoicesWitnessSha256 === null || digest(v.ChoicesWitnessSha256))
    || ['NativeRecipientUniverseVerified', 'CurrentSourceVerified', 'SourceParityVerified'].some(k => v[k] !== false)) return fail()
  const availability = v.FieldAvailability, counts = v.Counts
  for (const field of fenixDiscountFields) if (typeof availability[field] !== 'boolean' || !integer(counts[field], 500_000) || !availability[field] && counts[field] !== 0) return fail()
  if (!same(v.MissingFamilies, fenixDiscountFields.filter(f => !availability[f])) || v.HumanChoicesAvailable !== (v.OurSnapshotVerified && fenixDiscountFields.every(f => availability[f]))) return fail()
  if (fenixDiscountFields.some(f => availability[f]) && (!v.OurSnapshotVerified || !v.OrdinaryPublicationAvailable || !digest(v.InputWitnessSha256) || !digest(v.ChoicesWitnessSha256))) return fail()
  if (!v.OrdinaryPublicationAvailable && (v.OurSnapshotVerified || fenixDiscountFields.some(f => availability[f]) || v.InputWitnessSha256 !== null || v.ChoicesWitnessSha256 !== null)) return fail()
  return structuredClone(v) as FenixDiscountCatalogue
}
export function fenixChoicePageRequest(through: string, catalogue: FenixDiscountCatalogue, field: FenixDiscountField, search: string, offset: number, selected: readonly string[] = []): FenixDiscountChoicePageRequest {
  const request = fenixDiscountRequest(through)
  normalizeFenixChoiceCatalogue(catalogue, request)
  if (!fenixDiscountFields.includes(field) || !catalogue.OurSnapshotVerified || !catalogue.FieldAvailability[field] || !digest(catalogue.InputWitnessSha256) || !digest(catalogue.ChoicesWitnessSha256)
    || typeof search !== 'string' || search.length > 100 || !utf16(search) || !integer(offset, 500_000) || selected.length > 256 || new Set(selected).size !== selected.length) return fail()
  return { Scope: request, Field: field, Search: search, Offset: offset, Limit: 100, InputWitnessSha256: catalogue.InputWitnessSha256, ChoicesWitnessSha256: catalogue.ChoicesWitnessSha256, SelectedKeys: [...selected].sort() }
}
export function normalizeFenixChoicePage(v: unknown, request: FenixDiscountChoicePageRequest, expected: FenixDiscountCatalogue): FenixDiscountChoicePage {
  if (!object(v)) return fail()
  const catalogue = normalizeFenixChoiceCatalogue(v.Catalogue, request.Scope)
  if (catalogue.ResultSha256 !== expected.ResultSha256 || !same(catalogue.Counts, expected.Counts) || !same(catalogue.FieldAvailability, expected.FieldAvailability) || !same(catalogue.MissingFamilies, expected.MissingFamilies) || catalogue.InputWitnessSha256 !== request.InputWitnessSha256 || catalogue.ChoicesWitnessSha256 !== request.ChoicesWitnessSha256
    || v.Field !== request.Field || v.Search !== request.Search || v.Offset !== request.Offset || v.Limit !== request.Limit
    || !same(v.SelectedKeys, request.SelectedKeys) || !integer(v.Total, catalogue.Counts[request.Field]) || v.Total < request.Offset
    || !Array.isArray(v.Items) || v.Items.length !== Math.min(request.Limit, v.Total - request.Offset)
    || !Array.isArray(v.SelectedChoices) || v.SelectedChoices.length !== request.SelectedKeys.length || !digest(v.ResultSha256)
    || v.NextOffset !== (request.Offset + v.Items.length < v.Total ? request.Offset + v.Items.length : null)) return fail()
  const items = v.Items, selected = v.SelectedChoices
  if (!items.every(c => isFenixDiscountChoice(c, request.Field)) || !selected.every(c => isFenixDiscountChoice(c, request.Field))
    || new Set(items.map(c => c.Key)).size !== items.length || !same(selected.map(c => c.Key), request.SelectedKeys)) return fail()
  const seen = new Map(items.map(c => [c.Key, c])); if (selected.some(c => seen.has(c.Key) && !same(seen.get(c.Key), c))) return fail()
  return structuredClone({ ...v, Catalogue: catalogue }) as FenixDiscountChoicePage
}
/** Retains selected off-page captions only from a page authenticated to the exact current universe. */
export function fenixCaptionsForSelection(page: FenixDiscountChoicePage, keys: readonly string[]): FenixDiscountChoice[] {
  const rows = new Map([...page.Items, ...page.SelectedChoices].map(c => [c.Key, c])); if (keys.length > 256 || new Set(keys).size !== keys.length || keys.some(k => !rows.has(k))) return fail()
  return keys.map(k => structuredClone(rows.get(k)!))
}
export function selectedFenixPagedRequest(through: string, selected: FenixDiscountSelection, catalogue: FenixDiscountCatalogue | null, captions: FenixSelectedCaptions): FenixDiscountRequest {
  const request = fenixDiscountRequest(through)
  for (const field of fenixDiscountFields) {
    if (!selected[field].length) continue
    if (!catalogue || catalogue.Through !== through || !catalogue.OurSnapshotVerified || !catalogue.FieldAvailability[field] || !digest(catalogue.ChoicesWitnessSha256)) return fail()
    const offered = new Set(captions[field].filter(c => isFenixDiscountChoice(c, field)).map(c => c.Key))
    if (selected[field].some(key => !offered.has(key))) return fail()
  }
  request.Products = [...selected.Номенклатура]; request.Recipients = selected.ПолучательСкидки.map(key => { const [Type, Table, Reference] = key.split(':'); return { Type, Table, Reference } }); request.RegionCodes = [...selected.КодПоРегиону]
  request.ChoicesWitnessSha256 = catalogue?.Through === through && catalogue.OurSnapshotVerified ? catalogue.ChoicesWitnessSha256 : null
  return validateFenixDiscountRequest(request)
}
export function fenixPagedSelectionKeys(request: FenixDiscountRequest): FenixDiscountSelection {
  return { ...emptyFenixSelection(), Номенклатура: request.Products, ПолучательСкидки: request.Recipients.map(fenixRecipientKey), КодПоРегиону: request.RegionCodes }
}
