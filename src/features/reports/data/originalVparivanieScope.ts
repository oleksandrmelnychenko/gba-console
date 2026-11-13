import { matrixPeriodError, type MatrixRequest } from './originalVparivanie'
import type { ReportRequestBody } from '../types'

type MatrixScope = { World: 'fenix'; From: string; Through: string; GroupId: number }
export type MatrixScopeBinding = MatrixRequest & {
  GroupCaption: string; AdmissionPolicy: 'ExactCurrentInputWitnessV1'
  AcceptedInputWitnessSha256: string | null; AcceptanceProofSha256: string | null
}
const invalid = () => new Error('Оберіть одну групу товарів для оригінальної матриці без додаткових відборів.')
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
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

export function matrixBindingRequest(binding: MatrixScopeBinding): MatrixRequest {
  const { Version, World, SourceId, SchemaId, DefinitionSha256, From, Through, GroupId, GroupReference } = binding
  return { Version, World, SourceId, SchemaId, DefinitionSha256, From, Through, GroupId, GroupReference }
}
