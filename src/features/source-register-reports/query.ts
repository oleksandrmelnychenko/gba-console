import { formatRegisterPeriod, registerPeriodDraft } from './period'
import { hasExactMembers, REGISTER_LIMITS, REGISTER_STAGES, validateRegisterQuery } from './validation'
import type { RegisterSelection, SourceRegisterDescriptorWire, SourceRegisterQueryDraft, SourceRegisterQueryWire } from './types'

export function emptyRegisterQueryDraft(): SourceRegisterQueryDraft {
  return { from: registerPeriodDraft(), toExclusive: registerPeriodDraft(), rowFields: [], columnFields: [], selections: [] }
}

export function registerQueryDraft(query: SourceRegisterQueryWire, descriptor: SourceRegisterDescriptorWire): SourceRegisterQueryDraft {
  const error = validateRegisterQuery(query, descriptor)
  if (error) throw new Error(error)
  return { from: registerPeriodDraft(query.from), toExclusive: registerPeriodDraft(query.toExclusive), rowFields: [...query.rowFields],
    columnFields: [...query.columnFields], selections: query.selections.map(item => ({ ...item })) }
}

export function buildRegisterQuery(descriptor: SourceRegisterDescriptorWire, draft: SourceRegisterQueryDraft): SourceRegisterQueryWire {
  if (!hasExactMembers(draft, ['from', 'toExclusive', 'rowFields', 'columnFields', 'selections'])) throw new Error('Конструктор приймає лише період, осі та показники.')
  const from = formatRegisterPeriod(draft.from), toExclusive = formatRegisterPeriod(draft.toExclusive)
  if (!from || !toExclusive) throw new Error('Заповніть дату й час обох меж; частки секунди можуть містити до 7 цифр.')
  const candidate = { version: 1 as const, kind: 'register-query' as const, schema: descriptor.schema, from, toExclusive,
    rowFields: draft.rowFields, columnFields: draft.columnFields, selections: draft.selections }
  const error = validateRegisterQuery(candidate, descriptor)
  if (error) throw new Error(error)
  return { ...candidate, schema: { ...descriptor.schema }, rowFields: [...candidate.rowFields], columnFields: [...candidate.columnFields], selections: candidate.selections.map(item => ({ ...item })) }
}

export function serializeRegisterQuery(query: SourceRegisterQueryWire, descriptor: SourceRegisterDescriptorWire): string {
  const error = validateRegisterQuery(query, descriptor)
  if (error) throw new Error(error)
  const json = JSON.stringify({ version: 1, kind: 'register-query', schema: { world: query.schema.world, schemaHash: query.schema.schemaHash, registerUuid: query.schema.registerUuid }, from: query.from, toExclusive: query.toExclusive,
    rowFields: [...query.rowFields], columnFields: [...query.columnFields], selections: query.selections.map(item => ({ resourceUuid: item.resourceUuid, stage: item.stage })) })
  if (new TextEncoder().encode(json).byteLength > REGISTER_LIMITS.queryBytes) throw new Error('Параметри звіту перевищують дозволений розмір.')
  return json
}

export function moveRegisterItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const result = [...items], target = index + direction
  if (index >= 0 && index < result.length && target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]]
  return result
}

export function appendRegisterStages(selections: readonly RegisterSelection[], resourceUuid: string): RegisterSelection[] {
  const selected = new Set(selections.map(item => `${item.resourceUuid}:${item.stage}`))
  const result = [...selections]
  for (const stage of REGISTER_STAGES) if (!selected.has(`${resourceUuid}:${stage}`)) result.push({ resourceUuid, stage })
  return result
}
