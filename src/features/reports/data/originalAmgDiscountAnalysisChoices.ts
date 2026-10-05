import { amgDiscountAnalysisIdentity, amgDiscountAnalysisRequest, validateAmgDiscountAnalysisRequest, type AmgDiscountAnalysisRequest } from './originalAmgDiscountAnalysis'

export const amgDiscountAnalysisFields = ['Контрагент', 'Номенклатура'] as const
export type AmgDiscountAnalysisField = typeof amgDiscountAnalysisFields[number]
export type AmgDiscountAnalysisSelection = Record<AmgDiscountAnalysisField, string[]>
export const emptyAmgDiscountAnalysisSelection = (): AmgDiscountAnalysisSelection => ({ Контрагент: [], Номенклатура: [] })
export type AmgDiscountAnalysisReadiness = typeof amgDiscountAnalysisIdentity & {
  ModuleSha256: string; QuerySha256: string; Implemented: true; Executable: boolean;
  OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; NormalInputsReadinessVerified: boolean;
  Dependency: string | null; InputWitnessSha256: string | null
}
export type AmgDiscountAnalysisChoice = {
  Field: AmgDiscountAnalysisField; Type: '08'; TableReference: string; Reference: string; Caption: string; Deleted: boolean;
  MetadataObjectId: string; SourceReferenceTypeId: string; PhysicalTable: string
}
export type AmgDiscountAnalysisChoices = typeof amgDiscountAnalysisIdentity & {
  Through: string; RequestedCounterparties: string[]; RequestedProducts: string[];
  OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; Dependency: string | null;
  FieldAvailability: Record<AmgDiscountAnalysisField, boolean>; Choices: Record<AmgDiscountAnalysisField, AmgDiscountAnalysisChoice[]>;
  MissingFamilies: AmgDiscountAnalysisField[]; InputWitnessSha256: string | null; ChoicesWitnessSha256: string | null;
  ResultSha256: string; ReferenceCoverageVerified: boolean; HumanChoicesAvailable: boolean
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) && /[1-9a-f]/.test(v)
const reference = (v: unknown): v is string => typeof v === 'string' && /^[A-F0-9]{32}$/.test(v) && /[1-9A-F]/.test(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const identity = (v: Record<string, unknown>) => Object.entries(amgDiscountAnalysisIdentity).every(([k, value]) => v[k] === value)
const moduleSha = '850a4e7c39315436f11ac9edfc89787145d7ab1a7218008eade8b24d5c25c5bf'
const querySha = '360d7b09d5f43108134e445030842ffe7820779816146742d56add5dbc1d9962'
const cold = ['CurrentSourceVerified', 'NativeDateParametersVerified', 'NativeReferenceMaximumOrderingVerified',
  'NativeTypePriorityCompatibilityVerified', 'NativeTypedPercentageMaximumVerified', 'SourceParityVerified', 'SourceSyncEnabled', 'OriginalFullTaskAccepted'] as const
const dependency = (v: unknown) => v === null || typeof v === 'string' && /^[a-z][a-z_:]{0,200}$/.test(v)
const scope = (v: Record<string, unknown>) => identity(v) && v.ModuleSha256 === moduleSha && v.QuerySha256 === querySha && cold.every(k => v[k] === false)
const fail = () => new Error('Не вдалося підтвердити актуальні назви та дані звіту. Оновіть їх і повторіть відбір.')
const families = {
  Контрагент: { TableReference: '0000005A', MetadataObjectId: 'b6412cac-a3e5-4c01-b215-6903507b9229', SourceReferenceTypeId: '47e6dd42-cd5c-4e3a-9bc4-14816ed53d38', PhysicalTable: '_Reference90' },
  Номенклатура: { TableReference: '0000006C', MetadataObjectId: '22d218e8-ed66-4c7c-9e9f-3a9e5c99ab15', SourceReferenceTypeId: '44a01d39-c2b6-4751-85e6-06fdc2f23043', PhysicalTable: '_Reference108' },
} as const
export function normalizeAmgDiscountAnalysisReadiness(v: unknown): AmgDiscountAnalysisReadiness {
  if (!object(v) || !scope(v) || v.Implemented !== true || v.SourceSyncEnabled !== false || v.OriginalFullTaskAccepted !== false
    || v.NativeTypedPercentageMaximumVerified !== false || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || v.Executable !== (v.OrdinaryPublicationAvailable && v.OurSnapshotVerified) || v.NormalInputsReadinessVerified !== v.Executable
    || !dependency(v.Dependency) || (v.OrdinaryPublicationAvailable ? !digest(v.InputWitnessSha256) || v.Dependency !== null : v.InputWitnessSha256 !== null || v.Dependency === null)
    || !v.OrdinaryPublicationAvailable && v.OurSnapshotVerified) throw fail()
  return structuredClone(v) as AmgDiscountAnalysisReadiness
}
function choice(v: unknown, field: AmgDiscountAnalysisField): v is AmgDiscountAnalysisChoice {
  return object(v) && v.Field === field && v.Type === '08' && reference(v.Reference) && typeof v.Deleted === 'boolean'
    && typeof v.Caption === 'string' && !!v.Caption.trim() && v.Caption.length <= 1024 && !/[\p{Cc}]/u.test(v.Caption)
    && !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(v.Caption)
    && Object.entries(families[field]).every(([k, expected]) => v[k] === expected)
}
export function normalizeAmgDiscountAnalysisChoices(v: unknown, request: AmgDiscountAnalysisRequest): AmgDiscountAnalysisChoices {
  const current = validateAmgDiscountAnalysisRequest(request)
  if (!object(v) || !scope(v) || v.Through !== current.Through || !same(v.RequestedCounterparties, current.Counterparties) || !same(v.RequestedProducts, current.Products)
    || !object(v.FieldAvailability) || !object(v.Choices) || !same(Object.keys(v.FieldAvailability).sort(), [...amgDiscountAnalysisFields].sort())
    || !same(Object.keys(v.Choices).sort(), [...amgDiscountAnalysisFields].sort()) || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.ReferenceCoverageVerified !== 'boolean' || !dependency(v.Dependency) || !digest(v.ResultSha256) || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256))
    || !(v.ChoicesWitnessSha256 === null || digest(v.ChoicesWitnessSha256))) throw fail()
  const available = v.FieldAvailability, offered = v.Choices
  let count = 0
  for (const field of amgDiscountAnalysisFields) {
    const rows = offered[field]
    if (typeof available[field] !== 'boolean' || !Array.isArray(rows) || !available[field] && rows.length > 0
      || !rows.every(row => choice(row, field)) || new Set(rows.map(row => row.Reference)).size !== rows.length || (count += rows.length) > 500_000) throw fail()
  }
  if (!same(v.MissingFamilies, amgDiscountAnalysisFields.filter(f => !available[f])) || v.HumanChoicesAvailable !== (v.OrdinaryPublicationAvailable && v.ReferenceCoverageVerified && v.OurSnapshotVerified && amgDiscountAnalysisFields.every(f => available[f]))) throw fail()
  if (amgDiscountAnalysisFields.some(f => available[f]) && (!v.OurSnapshotVerified || !digest(v.InputWitnessSha256) || !digest(v.ChoicesWitnessSha256))) throw fail()
  if (!v.OurSnapshotVerified && (amgDiscountAnalysisFields.some(f => available[f]) || v.InputWitnessSha256 !== null || v.ChoicesWitnessSha256 !== null)) throw fail()
  if (v.OrdinaryPublicationAvailable && (!v.OurSnapshotVerified || !v.ReferenceCoverageVerified) || !v.OrdinaryPublicationAvailable && v.Dependency === null) throw fail()
  return structuredClone(v) as AmgDiscountAnalysisChoices
}
export function selectedAmgDiscountAnalysisRequest(through: string, selected: AmgDiscountAnalysisSelection, names: AmgDiscountAnalysisChoices | null): AmgDiscountAnalysisRequest {
  const request = amgDiscountAnalysisRequest(through)
  for (const field of amgDiscountAnalysisFields) {
    if (!selected[field].length) continue
    if (!names || names.Through !== through || !names.OrdinaryPublicationAvailable || !names.ReferenceCoverageVerified || !names.OurSnapshotVerified || !names.FieldAvailability[field] || !digest(names.ChoicesWitnessSha256)) throw fail()
    const offered = new Set(names.Choices[field].map(c => c.Reference))
    if (selected[field].some(key => !offered.has(key))) throw fail()
  }
  request.Counterparties = [...selected.Контрагент]; request.Products = [...selected.Номенклатура]
  if (names?.Through === through && names.OrdinaryPublicationAvailable && names.ReferenceCoverageVerified && names.OurSnapshotVerified) request.ChoicesWitnessSha256 = names.ChoicesWitnessSha256
  return validateAmgDiscountAnalysisRequest(request)
}
