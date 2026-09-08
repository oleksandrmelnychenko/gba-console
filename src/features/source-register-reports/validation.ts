import { isExactRegisterNumber, registerScaleIndex } from './exactNumber'
import { isRegisterLocalTimestamp } from './period'
import type { RegisterAtom, RegisterField, RegisterSchemaKey, SourceRegisterDescriptorWire, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'

export const REGISTER_STAGES = ['Opening', 'Receipt', 'Expense', 'Turnover', 'Closing'] as const
export const REGISTER_STAGE_LABELS = { Opening: 'Початковий залишок', Receipt: 'Прихід', Expense: 'Витрата', Turnover: 'Оборот', Closing: 'Кінцевий залишок' } as const
export const REGISTER_LIMITS = { dimensions: 64, resources: 256, selections: 1280, outputCells: 1_000_000, queryBytes: 131_072 } as const
const UUID = /^(?!00000000-0000-0000-0000-000000000000$)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const INT64_MAX = '9223372036854775807'

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function hasExactMembers(value: unknown, members: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === members.length && members.every(key => Object.hasOwn(value, key))
}
function unicode(value: unknown, maximum: number): value is string {
  if (typeof value !== 'string' || value.length > maximum) return false
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
function hash(value: unknown): value is string { return typeof value === 'string' && HASH.test(value) }
function schemaKey(value: unknown): value is RegisterSchemaKey {
  return hasExactMembers(value, ['world', 'schemaHash', 'registerUuid']) && typeof value.world === 'string'
    && /^[a-z0-9-]{1,64}$/.test(value.world) && hash(value.schemaHash) && uuid(value.registerUuid)
}
export function sameRegisterSchema(left: RegisterSchemaKey, right: RegisterSchemaKey): boolean {
  return left.world === right.world && left.schemaHash === right.schemaHash && left.registerUuid === right.registerUuid
}
function alternative(value: unknown): boolean {
  if (!record(value)) return false
  if (value.kind === 'Reference') return hasExactMembers(value, ['kind', 'sourceTypeUuid']) && uuid(value.sourceTypeUuid)
  if (value.kind === 'Number') {
    if (!hasExactMembers(value, ['kind', 'precision', 'scale']) || typeof value.precision !== 'string' || typeof value.scale !== 'string') return false
    const precision = registerScaleIndex(value.precision), scale = registerScaleIndex(value.scale)
    return precision > 0 && scale >= 0 && scale <= precision
  }
  return hasExactMembers(value, ['kind']) && ['Undefined', 'Null', 'Boolean', 'String', 'LocalDateTime'].includes(String(value.kind))
}
function field(value: unknown, resource: boolean): value is RegisterField {
  if (!hasExactMembers(value, ['uuid', 'caption', 'isResource', 'referenceLayout', 'alternatives'])
    || !uuid(value.uuid) || !unicode(value.caption, 512) || !value.caption.trim() || value.isResource !== resource
    || !Array.isArray(value.alternatives) || !value.alternatives.length || value.alternatives.length > 64 || !value.alternatives.every(alternative)) return false
  const alternatives = value.alternatives as RegisterField['alternatives']
  const keys = alternatives.map(item => item.kind === 'Reference' ? `${item.kind}:${item.sourceTypeUuid}` : item.kind)
  if (new Set(keys).size !== keys.length) return false
  const hasReferences = alternatives.some(item => item.kind === 'Reference')
  if (hasReferences ? !['Fixed', 'Composite'].includes(String(value.referenceLayout)) : value.referenceLayout !== 'None') return false
  if (value.referenceLayout === 'Fixed' && (alternatives.length !== 1 || alternatives[0].kind !== 'Reference')) return false
  return !resource || (alternatives.length === 1 && alternatives[0].kind === 'Number')
}

/** Structural boundary for already-decoded props. Raw JSON token/duplicate-member checks belong to the transport codec. */
export function validateRegisterDescriptor(value: unknown): string | null {
  if (!hasExactMembers(value, ['version', 'kind', 'schema', 'dimensions', 'resources']) || value.version !== 1 || value.kind !== 'register-schema'
    || !schemaKey(value.schema) || !Array.isArray(value.dimensions) || value.dimensions.length > REGISTER_LIMITS.dimensions
    || !Array.isArray(value.resources) || !value.resources.length || value.resources.length > REGISTER_LIMITS.resources
    || !value.dimensions.every(item => field(item, false)) || !value.resources.every(item => field(item, true))) return 'Опис регістру некоректний або має непідтримувану версію.'
  const ids = [...value.dimensions, ...value.resources].map(item => item.uuid)
  return new Set(ids).size === ids.length ? null : 'Опис регістру містить повторні ідентифікатори полів.'
}

export function validateRegisterQuery(value: unknown, descriptor: SourceRegisterDescriptorWire): string | null {
  const descriptorError = validateRegisterDescriptor(descriptor)
  if (descriptorError) return descriptorError
  if (!hasExactMembers(value, ['version', 'kind', 'schema', 'from', 'toExclusive', 'rowFields', 'columnFields', 'selections'])
    || value.version !== 1 || value.kind !== 'register-query' || !schemaKey(value.schema) || !sameRegisterSchema(value.schema, descriptor.schema)) return 'Параметри звіту не відповідають вибраному регістру та схемі.'
  if (!isRegisterLocalTimestamp(value.from) || !isRegisterLocalTimestamp(value.toExclusive) || value.from >= value.toExclusive) return 'Вкажіть коректний початок і пізнішу кінцеву межу періоду.'
  const dimensions = new Set(descriptor.dimensions.map(item => item.uuid))
  if (!Array.isArray(value.rowFields) || !Array.isArray(value.columnFields) || value.rowFields.length + value.columnFields.length > descriptor.dimensions.length
    || [...value.rowFields, ...value.columnFields].some(item => typeof item !== 'string' || !dimensions.has(item))) return 'Осі можуть містити лише виміри вибраного регістру.'
  const axes = [...value.rowFields, ...value.columnFields]
  if (new Set(axes).size !== axes.length) return 'Вимір не може повторюватися в рядках або колонках.'
  if (!Array.isArray(value.selections) || !value.selections.length || value.selections.length > REGISTER_LIMITS.selections) return 'Оберіть від 1 до 1280 показників.'
  const resources = new Set(descriptor.resources.map(item => item.uuid)), selected = new Set<string>()
  for (const selection of value.selections) {
    if (!hasExactMembers(selection, ['resourceUuid', 'stage']) || typeof selection.resourceUuid !== 'string' || !resources.has(selection.resourceUuid)
      || typeof selection.stage !== 'string' || !(REGISTER_STAGES as readonly string[]).includes(selection.stage)) return 'Показник має містити ресурс цього регістру та підтримувану стадію.'
    const key = `${selection.resourceUuid}:${selection.stage}`
    if (selected.has(key)) return 'Один ресурс і стадія не можуть повторюватися.'
    selected.add(key)
  }
  return null
}

function atomFits(value: unknown, definition: RegisterField): value is RegisterAtom {
  if (!record(value)) return false
  const allowed = definition.alternatives.filter(item => item.kind === value.kind)
  if (!allowed.length) return false
  switch (value.kind) {
    case 'Undefined': case 'Null': return hasExactMembers(value, ['kind'])
    case 'Boolean': return hasExactMembers(value, ['kind', 'value']) && typeof value.value === 'boolean'
    case 'String': return hasExactMembers(value, ['kind', 'value']) && unicode(value.value, 4096)
    case 'LocalDateTime': return hasExactMembers(value, ['kind', 'value']) && isRegisterLocalTimestamp(value.value)
    case 'Number': {
      if (!hasExactMembers(value, ['kind', 'coefficient', 'scale']) || !isExactRegisterNumber({ coefficient: value.coefficient, scale: value.scale }, 128)) return false
      const qualifier = allowed.find(item => item.kind === 'Number')
      if (!qualifier || qualifier.kind !== 'Number') return false
      const coefficient = value.coefficient as string, scale = registerScaleIndex(value.scale as string)
      const length = coefficient.startsWith('-') ? coefficient.length - 1 : coefficient.length
      return coefficient === '0' || (scale <= registerScaleIndex(qualifier.scale) && Math.max(0, length - scale) <= registerScaleIndex(qualifier.precision) - registerScaleIndex(qualifier.scale))
    }
    case 'Reference': {
      if (!uuid(value.sourceTypeUuid) || !allowed.some(item => item.kind === 'Reference' && item.sourceTypeUuid === value.sourceTypeUuid)
        || typeof value.rawReferenceHex !== 'string' || !/^[0-9a-f]{32}$/.test(value.rawReferenceHex)) return false
      if (definition.referenceLayout === 'Fixed') return hasExactMembers(value, ['kind', 'sourceTypeUuid', 'rawReferenceHex'])
      return hasExactMembers(value, ['kind', 'sourceTypeUuid', 'rawReferenceHex', 'rawPhysicalTypeTagHex', 'rawPhysicalTableTagHex'])
        && typeof value.rawPhysicalTypeTagHex === 'string' && /^[0-9a-f]{2}$/.test(value.rawPhysicalTypeTagHex)
        && typeof value.rawPhysicalTableTagHex === 'string' && /^[0-9a-f]{8}$/.test(value.rawPhysicalTableTagHex)
    }
    default: return false
  }
}

/** Stable typed identity is independent of object member order and never uses a caption. */
export function registerAtomIdentity(atom: RegisterAtom): string {
  switch (atom.kind) {
    case 'Undefined': case 'Null': return atom.kind
    case 'Reference': return JSON.stringify([atom.kind, atom.sourceTypeUuid, atom.rawReferenceHex, atom.rawPhysicalTypeTagHex ?? null, atom.rawPhysicalTableTagHex ?? null])
    case 'Number': return JSON.stringify([atom.kind, atom.coefficient, atom.scale])
    default: return JSON.stringify([atom.kind, atom.value])
  }
}

export function validateRegisterResult(value: unknown, descriptor: SourceRegisterDescriptorWire): string | null {
  const descriptorError = validateRegisterDescriptor(descriptor)
  if (descriptorError) return descriptorError
  if (!hasExactMembers(value, ['version', 'kind', 'schema', 'publication', 'query', 'groups', 'grandValues', 'sourceParityVerified'])
    || value.version !== 1 || value.kind !== 'register-statement' || value.sourceParityVerified !== false
    || !schemaKey(value.schema) || !sameRegisterSchema(value.schema, descriptor.schema)) return 'Результат не відповідає версії та схемі цього регістру.'
  const queryError = validateRegisterQuery(value.query, descriptor)
  if (queryError) return queryError
  const query = value.query as SourceRegisterQueryWire
  if (!hasExactMembers(value.publication, ['metadata', 'contentHash']) || !hash(value.publication.contentHash)) return 'Результат не містить коректного посилання на опублікований знімок.'
  const metadata = value.publication.metadata
  if (!hasExactMembers(metadata, ['schema', 'scopeHash', 'principalPolicyHash', 'captureId', 'revision', 'coverageStart', 'coverageEndExclusive', 'sourceReceiptHash', 'complete'])
    || !schemaKey(metadata.schema) || !sameRegisterSchema(metadata.schema, descriptor.schema) || !hash(metadata.scopeHash) || !hash(metadata.principalPolicyHash)
    || !uuid(metadata.captureId) || typeof metadata.revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(metadata.revision)
    || (metadata.revision.length === INT64_MAX.length && metadata.revision > INT64_MAX) || !hash(metadata.sourceReceiptHash) || metadata.complete !== true
    || !isRegisterLocalTimestamp(metadata.coverageStart) || !isRegisterLocalTimestamp(metadata.coverageEndExclusive)
    || metadata.coverageStart > query.from || metadata.coverageEndExclusive < query.toExclusive) return 'Контекст знімка неповний або не покриває вибраний період.'
  const width = query.selections.length
  const resourceScales = new Map(descriptor.resources.map(item => [item.uuid, item.alternatives[0].kind === 'Number' ? registerScaleIndex(item.alternatives[0].scale) : -1]))
  const valuesFitSelections = (values: unknown): boolean => Array.isArray(values) && values.length === width
    && values.every((item, index) => isExactRegisterNumber(item) && registerScaleIndex(item.scale) <= resourceScales.get(query.selections[index].resourceUuid)!)
  if (!Array.isArray(value.groups) || value.groups.length > 200_000 || (value.groups.length + 1) * width > REGISTER_LIMITS.outputCells
    || !valuesFitSelections(value.grandValues)) return 'Порушено форму або точність значень результату.'
  const fields = new Map(descriptor.dimensions.map(item => [item.uuid, item]))
  const rowFields = query.rowFields.map(id => fields.get(id)!), columnFields = query.columnFields.map(id => fields.get(id)!)
  const keys = new Set<string>(), referenceTags = new Map<string, string>()
  for (const group of value.groups) {
    if (!hasExactMembers(group, ['rowKey', 'columnKey', 'values']) || !Array.isArray(group.rowKey) || !Array.isArray(group.columnKey)
      || group.rowKey.length !== rowFields.length || group.columnKey.length !== columnFields.length
      || !group.rowKey.every((atom, index) => atomFits(atom, rowFields[index])) || !group.columnKey.every((atom, index) => atomFits(atom, columnFields[index]))
      || !valuesFitSelections(group.values)) return 'Результат містить некоректний ключ групи або числове значення.'
    const atoms = [...group.rowKey, ...group.columnKey] as RegisterAtom[]
    for (const atom of atoms) {
      if (atom.kind !== 'Reference' || atom.rawPhysicalTypeTagHex === undefined) continue
      const tag = `${atom.rawPhysicalTypeTagHex}:${atom.rawPhysicalTableTagHex}`
      const prior = referenceTags.get(atom.sourceTypeUuid)
      if (prior !== undefined && prior !== tag) return 'Тип посилання має суперечливе фізичне позначення.'
      referenceTags.set(atom.sourceTypeUuid, tag)
    }
    const key = JSON.stringify([group.rowKey.map(registerAtomIdentity), group.columnKey.map(registerAtomIdentity)])
    if (keys.has(key)) return 'Результат містить повторний точний ключ групи.'
    keys.add(key)
  }
  return null
}

export function assertRegisterResult(value: unknown, descriptor: SourceRegisterDescriptorWire): asserts value is SourceRegisterResultWire {
  const error = validateRegisterResult(value, descriptor)
  if (error) throw new Error(error)
}
