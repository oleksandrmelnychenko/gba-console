import type { ReportMeasurementGroup, ReportRequestBody, ReportTemplate } from '../types'

export type ReportWorkspaceSnapshot = {
  name: string
  data: ReportRequestBody
  measurements: ReportMeasurementGroup[]
  activeTemplate: ReportTemplate | null
  previousPeriod: { from: string; to: string }
}
export type ReportWorkspaceDraft = {
  version: 1
  ownerId: string
  savedAt: string
  snapshot: ReportWorkspaceSnapshot
  previousSnapshot?: ReportWorkspaceSnapshot
}
export type WorkspaceDraftFailure = { ok: false; reason: 'invalid' | 'unsupported' | 'owner-mismatch' | 'too-large' }
type Encoded<T> = { ok: true; value: string; data: T } | WorkspaceDraftFailure
export const REPORT_WORKSPACE_DRAFT_MAX_BYTES = 1024 * 1024
const MAX_DEPTH = 64
const MAX_NODES = 100_000
const MAX_ARRAY = 10_000
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor', 'DocumentURL', 'PdfDocumentURL'])
const encoder = new TextEncoder()

export function reportWorkspaceDraftKey(ownerId: string) {
  return `report-workspace-draft:v1:${encodeURIComponent(ownerId)}`
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const integer = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value)
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)
const nullableOptional = (value: unknown, check: (value: unknown) => boolean) => value == null || check(value)
const string = (value: unknown) => typeof value === 'string'
const boolean = (value: unknown) => typeof value === 'boolean'
const arrayOf = (value: unknown, check: (value: unknown) => boolean) => Array.isArray(value) && value.every(check)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const allowed = new Set(keys)
  return Object.keys(value).every(key => allowed.has(key))
}

function measurement(value: unknown) {
  return record(value) && string(value.Name) && integer(value.Type) && typeof value.IsChecked === 'boolean' && optional(value.Label, string)
}
function measurementGroup(value: unknown) {
  return record(value) && string(value.Name) && typeof value.IsChecked === 'boolean' && optional(value.Label, string)
    && arrayOf(value.SubList, measurement)
}
function grouping(value: unknown, savedDefinition: boolean) {
  return record(value) && integer(value.type) && (savedDefinition
    ? nullableOptional(value.key, string) && nullableOptional(value.label, string)
    : string(value.key) && string(value.label))
}
function requestMeasurement(value: unknown, savedDefinition: boolean) {
  return record(value) && integer(value.Type) && nullableOptional(value.IsChecked, boolean)
    && (savedDefinition ? nullableOptional(value.Name, string) : string(value.Name))
    && nullableOptional(value.Label, string) && nullableOptional(value.parentName, string)
}
function selectionField(value: unknown) {
  return record(value) && optional(value.Type, integer) && nullableOptional(value.Name, string)
}
function selection(value: unknown, savedDefinition: boolean) {
  if (!record(value) || !nullableOptional(value.IsChecked, boolean)) return false
  if (!savedDefinition) return record(value.SelectedField) && string(value.SelectedField.Name) && integer(value.SelectedField.Type)
    && record(value.FilterCondition) && string(value.FilterCondition.Name) && integer(value.FilterCondition.Type)
    && arrayOf(value.Values, item => record(item) && string(item.Name) && (record(item.Data) || string(item.Data))
      && nullableOptional(item.Value, data => typeof data === 'number' || string(data)))
  return nullableOptional(value.SelectedField, selectionField) && nullableOptional(value.FilterCondition, selectionField)
    && nullableOptional(value.Values, values => arrayOf(values, item => record(item) && nullableOptional(item.Name, string)
      && nullableOptional(item.Data, data => record(data) || string(data))
      && nullableOptional(item.Value, data => typeof data === 'number' || string(data))))
}
function request(value: unknown, savedDefinition = false) {
  return record(value) && string(value.from) && string(value.to) && optional(value.dataSource, integer)
    && optional(value.valuationClientAgreementId, item => item === null || integer(item))
    && record(value.sorted) && arrayOf(value.sorted.Row, item => grouping(item, savedDefinition))
    && arrayOf(value.sorted.Col, item => grouping(item, savedDefinition))
    && arrayOf(value.sorted.Measurements, item => requestMeasurement(item, savedDefinition))
    && arrayOf(value.selections, item => selection(item, savedDefinition))
}
function template(value: unknown) {
  return value === null || (record(value) && string(value.Name) && request(value.Data, true)
    && optional(value.Id, string) && optional(value.Revision, integer) && optional(value.UpdatedAtUtc, string))
}
function snapshotShape(value: unknown): value is ReportWorkspaceSnapshot {
  return record(value) && exactKeys(value, ['name', 'data', 'measurements', 'activeTemplate', 'previousPeriod'])
    && string(value.name) && request(value.data) && arrayOf(value.measurements, measurementGroup) && template(value.activeTemplate)
    && record(value.previousPeriod) && exactKeys(value.previousPeriod, ['from', 'to'])
    && string(value.previousPeriod.from) && string(value.previousPeriod.to)
}

/** Validate JSON before stringify: never turn NaN into null or silently lose array entries. */
function jsonTree(value: unknown, depth = 0, ancestors = new Set<object>(), budget = { nodes: 0 }): boolean {
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'string') return value.length <= REPORT_WORKSPACE_DRAFT_MAX_BYTES
  if (typeof value === 'number') return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) && !Object.is(value, -0)
  if (typeof value !== 'object' || ancestors.has(value)) return false
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
  const keys = Reflect.ownKeys(value)
  if (!Array.isArray(value) && keys.length > MAX_ARRAY) return false
  if (keys.some(key => typeof key !== 'string')) return false
  if (Array.isArray(value) && (value.length > MAX_ARRAY || keys.length !== value.length + 1)) return false
  if (Array.isArray(value) && keys.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(String(key)) || Number(key) >= value.length))) return false
  ancestors.add(value)
  const valid = keys.every(key => {
    if (key === 'length' && Array.isArray(value)) return true
    if (forbiddenKeys.has(key as string)) return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (!descriptor.enumerable || !('value' in descriptor)) return false
    if (descriptor.value === undefined && !Array.isArray(value)) return true // Optional object properties are absent in JSON.
    return jsonTree(descriptor.value, depth + 1, ancestors, budget)
  })
  ancestors.delete(value)
  return valid
}

function withinBytes(raw: string) {
  return raw.length <= REPORT_WORKSPACE_DRAFT_MAX_BYTES && encoder.encode(raw).byteLength <= REPORT_WORKSPACE_DRAFT_MAX_BYTES
}

// JSON.parse otherwise rounds an invalid fractional identifier to a safe integer.
function exactIntegerToken(token: string, value: number) {
  const [mantissa, exponent = '0'] = token.toLowerCase().split('e')
  const digits = mantissa.replace(/[-.]/g, '').replace(/^0+/, '')
  if (!digits) return !Object.is(value, -0)
  const shift = Number(exponent) - (mantissa.split('.')[1]?.length ?? 0)
  if (shift >= 0) return digits.length + shift <= 16 && BigInt(`${token.startsWith('-') ? '-' : ''}${digits}${'0'.repeat(shift)}`) === BigInt(value)
  const remove = -shift
  return remove < digits.length && digits.endsWith('0'.repeat(Math.min(remove, digits.length)))
    && BigInt(`${token.startsWith('-') ? '-' : ''}${digits.slice(0, -remove)}`) === BigInt(value)
}

/** Bounded JSON grammar also rejects duplicate keys and rounded integer tokens. */
function parseBounded(raw: string): unknown {
  let at = 0
  let nodes = 0
  const whitespace = () => { while (at < raw.length && /[\t\n\r ]/.test(raw[at])) at++ }
  function readString() {
    const start = at++
    while (at < raw.length) {
      const char = raw[at++]
      if (char === '\\') { at++; continue }
      if (char === '"') return JSON.parse(raw.slice(start, at)) as string
    }
    throw new Error('Unclosed string')
  }
  function read(depth: number): unknown {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error('JSON bounds')
    whitespace()
    const char = raw[at]
    if (char === '"') return readString()
    if (char === '{' || char === '[') {
      const object = char === '{'
      const result: Record<string, unknown> | unknown[] = object ? {} : []
      at++; whitespace()
      const close = object ? '}' : ']'
      if (raw[at] === close) { at++; return result }
      for (let count = 0; ; count++) {
        if (count >= MAX_ARRAY) throw new Error('JSON bounds')
        whitespace()
        let key = String(count)
        if (object) {
          if (raw[at] !== '"') throw new Error('Object key')
          key = readString(); whitespace()
          if (raw[at++] !== ':' || Object.hasOwn(result, key) || forbiddenKeys.has(key)) throw new Error('Object member')
        }
        const value = read(depth + 1)
        if (Array.isArray(result)) result.push(value)
        else Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true })
        whitespace()
        const delimiter = raw[at++]
        if (delimiter === close) return result
        if (delimiter !== ',') throw new Error('JSON delimiter')
      }
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (raw.startsWith(literal, at)) { at += literal.length; return value }
    }
    const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
    number.lastIndex = at
    const match = number.exec(raw)
    if (!match || match[0].length > 128) throw new Error('JSON number')
    at = number.lastIndex
    const value = Number(match[0])
    if (!Number.isFinite(value) || (Number.isInteger(value) && (!Number.isSafeInteger(value) || !exactIntegerToken(match[0], value)))) throw new Error('Unsafe JSON number')
    return value
  }
  const value = read(0)
  whitespace()
  if (at !== raw.length) throw new Error('Trailing JSON')
  return value
}

export function encodeReportWorkspaceSnapshot(value: ReportWorkspaceSnapshot): Encoded<ReportWorkspaceSnapshot> {
  try {
    if (!jsonTree(value) || !snapshotShape(value)) return { ok: false, reason: 'invalid' }
    const raw = JSON.stringify(value)
    if (!withinBytes(raw)) return { ok: false, reason: 'too-large' }
    return { ok: true, value: raw, data: JSON.parse(raw) as ReportWorkspaceSnapshot }
  } catch { return { ok: false, reason: 'invalid' } }
}

function envelopeShape(value: unknown): value is ReportWorkspaceDraft {
  return record(value) && exactKeys(value, ['version', 'ownerId', 'savedAt', 'snapshot', 'previousSnapshot'])
    && value.version === 1 && string(value.ownerId) && value.ownerId.length > 0 && value.ownerId.length <= 256
    && typeof value.savedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.savedAt)
    && !Number.isNaN(Date.parse(value.savedAt)) && new Date(value.savedAt).toISOString() === value.savedAt
    && snapshotShape(value.snapshot) && optional(value.previousSnapshot, snapshotShape)
}

export function decodeReportWorkspaceDraft(raw: string, ownerId: string): { ok: true; data: ReportWorkspaceDraft } | WorkspaceDraftFailure {
  if (!withinBytes(raw)) return { ok: false, reason: 'too-large' }
  try {
    const value = parseBounded(raw)
    if (record(value) && value.version !== 1) return { ok: false, reason: 'unsupported' }
    if (!envelopeShape(value) || !jsonTree(value)) return { ok: false, reason: 'invalid' }
    if (value.ownerId !== ownerId) return { ok: false, reason: 'owner-mismatch' }
    return { ok: true, data: value }
  } catch { return { ok: false, reason: 'invalid' } }
}

export function encodeReportWorkspaceDraft(value: ReportWorkspaceDraft): Encoded<ReportWorkspaceDraft> {
  try {
    if (!jsonTree(value) || !envelopeShape(value)) return { ok: false, reason: 'invalid' }
    const raw = JSON.stringify(value)
    if (!withinBytes(raw)) return { ok: false, reason: 'too-large' }
    return { ok: true, value: raw, data: JSON.parse(raw) as ReportWorkspaceDraft }
  } catch { return { ok: false, reason: 'invalid' } }
}
