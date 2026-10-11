import { isMatrixCapability, matrixPeriodError, matrixRequest, normalizeMatrixResult, type MatrixCapability, type MatrixRequest, type MatrixResult } from './originalVparivanie'
import type { ReportRequestBody } from '../types'

export type MatrixScope = { World: 'fenix'; From: string; Through: string; GroupId: number }
export type MatrixScopeBinding = MatrixRequest & {
  GroupCaption: string; AdmissionPolicy: 'ExactCurrentInputWitnessV1'
  AcceptedInputWitnessSha256: string | null; AcceptanceProofSha256: string | null
}
const invalid = () => new Error('Оберіть одну групу товарів для оригінальної матриці без додаткових відборів.')
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
function onlyKeys(value: unknown, keys: readonly string[]) {
  const allowed = new Set(keys)
  return object(value) && Object.keys(value).every(key => allowed.has(key))
}

/** Retain the saved form's complete scope; never silently discard another filter or option. */
export function originalMatrixScope(request: ReportRequestBody): MatrixScope {
  const allowed = new Set(['dataSource', 'from', 'to', 'selections', 'sorted', 'currentVparivanieFullScope'])
  if (request.dataSource !== 39 || request.currentVparivanieFullScope !== true
    || Object.entries(request).some(([key, value]) => !allowed.has(key) && value != null)
    || matrixPeriodError(request.from, request.to)
    || !onlyKeys(request.sorted, ['Row', 'Col', 'Measurements'])
    || !Array.isArray(request.sorted.Row) || !Array.isArray(request.sorted.Col) || !Array.isArray(request.sorted.Measurements)
    || [...request.sorted.Row, ...request.sorted.Col].some(group => !onlyKeys(group, ['key', 'label', 'type']))
    || request.sorted.Measurements.some(measure => !onlyKeys(measure, ['Name', 'Label', 'Type', 'IsChecked', 'parentName']))
    || request.sorted.Row.map(row => row.type).join(',') !== '5'
    || request.sorted.Col.map(column => column.type).join(',') !== '74,75'
    || request.sorted.Measurements.length !== 1 || request.sorted.Measurements[0].Type !== 83
    || request.sorted.Measurements[0].IsChecked !== true || request.selections.length !== 1) throw invalid()
  const selection = request.selections[0]
  if (!onlyKeys(selection, ['IsChecked', 'SelectedField', 'FilterCondition', 'Values'])
    || !onlyKeys(selection.SelectedField, ['Type', 'Name', 'ParentType'])
    || !onlyKeys(selection.FilterCondition, ['Type', 'Name'])
    || selection.IsChecked !== true || selection.SelectedField.Type !== 4 || selection.FilterCondition.Type !== 6
    || !Array.isArray(selection.Values) || selection.Values.length !== 1) throw invalid()
  const selected = selection.Values[0]
  if (!onlyKeys(selected, ['Data', 'Name', 'Value']) || !onlyKeys(selected.Data, ['Id', 'Name', 'FullName', 'Code', 'NetUid'])
    || !Number.isInteger(selected.Value) || selected.Value < -2147483648 || selected.Value > 2147483647) throw invalid()
  const raw = selection.Values[0].Data.Id
  const id = typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw invalid()
  return { World: 'fenix', From: request.from, Through: request.to, GroupId: id }
}

/** The normal catalogue supplies the reference; local IDs and captions are never Source aliases. */
export function normalizeMatrixScopeBinding(value: unknown, capability: MatrixCapability, scope: MatrixScope): MatrixScopeBinding {
  if (!isMatrixCapability(capability) || !capability.Executable || !object(value)
    || value.AdmissionPolicy !== 'ExactCurrentInputWitnessV1' || typeof value.GroupCaption !== 'string' || value.GroupCaption.length > 8192
    || Object.entries(scope).some(([key, item]) => value[key] !== item)
    || typeof value.GroupReference !== 'string'
    || !(value.AcceptedInputWitnessSha256 === null && value.AcceptanceProofSha256 === null
      || hash(value.AcceptedInputWitnessSha256) && hash(value.AcceptanceProofSha256))) throw invalid()
  const request = matrixRequest(capability, scope.From, scope.Through, scope.GroupId, value.GroupReference)
  if (Object.entries(request).some(([key, item]) => value[key] !== item)) throw invalid()
  return { ...request, GroupCaption: value.GroupCaption, AdmissionPolicy: value.AdmissionPolicy,
    AcceptedInputWitnessSha256: value.AcceptedInputWitnessSha256 as string | null, AcceptanceProofSha256: value.AcceptanceProofSha256 as string | null }
}

export function matrixBindingRequest(binding: MatrixScopeBinding): MatrixRequest {
  const { Version, World, SourceId, SchemaId, DefinitionSha256, From, Through, GroupId, GroupReference } = binding
  return { Version, World, SourceId, SchemaId, DefinitionSha256, From, Through, GroupId, GroupReference }
}

export function normalizeScopedMatrixResult(value: unknown, binding: MatrixScopeBinding): MatrixResult {
  const result = normalizeMatrixResult(value, matrixBindingRequest(binding))
  const sameAdmission = result.AcceptedInputWitnessSha256 === binding.AcceptedInputWitnessSha256
    && result.AcceptanceProofSha256 === binding.AcceptanceProofSha256
  const unavailable = !result.Available && result.ExactScopeAccepted === false
    && result.AcceptedInputWitnessSha256 === null && result.AcceptanceProofSha256 === null
  if (result.AdmissionPolicy !== binding.AdmissionPolicy || typeof result.ExactScopeAccepted !== 'boolean'
    || !sameAdmission && !unavailable
    || result.ExactScopeAccepted && (!binding.AcceptanceProofSha256 || !binding.AcceptedInputWitnessSha256
      || !result.Available || result.InputWitnessSha256 !== binding.AcceptedInputWitnessSha256)
    || result.Available && result.GroupCaption !== binding.GroupCaption) throw invalid()
  return result
}

/** Per-form admission leaves the overall six-report acceptance flags unchanged. */
export function matrixScopeAccepted(result: MatrixResult): boolean {
  if (result.AdmissionPolicy !== undefined || result.ExactScopeAccepted !== undefined)
    return result.AdmissionPolicy === 'ExactCurrentInputWitnessV1' && result.ExactScopeAccepted === true
      && result.Available && result.NormalInputsComplete && result.OurSnapshotVerified
      && hash(result.AcceptanceProofSha256) && hash(result.AcceptedInputWitnessSha256)
      && result.InputWitnessSha256 === result.AcceptedInputWitnessSha256
  return result.Available && result.SourceParityVerified && result.OriginalFullTaskAccepted
}
