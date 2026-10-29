import type { WorkbookAttribute, WorkbookReference } from './workbookPreview'
import { workbookText } from './workbookPresentation'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(',') === names.toSorted().join(',')
const fail = (): never => { throw new Error('Сервер не підтвердив повний список поточних груп товару.') }
const positiveId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
const guid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000'

/** List identities are kept even when names repeat; empty is known, missing coverage is unavailable. */
export function readProductGroupAttribute(raw: unknown, exactProduct: boolean): WorkbookAttribute {
  if (!record(raw) || !keys(raw, ['type', 'state', 'values', 'inputSha256', 'references']) || raw.type !== 67
    || !['known', 'unavailable'].includes(String(raw.state)) || !Array.isArray(raw.values) || raw.values.length !== 0
    || typeof raw.inputSha256 !== 'string' || !/^[a-f\d]{64}$/.test(raw.inputSha256)
    || !Array.isArray(raw.references) || raw.state === 'unavailable' && raw.references.length !== 0
    || !exactProduct && raw.state !== 'unavailable'
    || new TextEncoder().encode(JSON.stringify(raw.references)).length > 65536) return fail()
  const ids = new Set<string>(), netUids = new Set<string>()
  let previous = 0n
  let conservativeBytes = 2
  const references: WorkbookReference[] = raw.references.map(value => {
    if (!record(value) || !keys(value, ['id', 'netUid', 'caption']) || !positiveId(value.id) || !guid(value.netUid)
      || !(value.caption === null || workbookText(value.caption)) || ids.has(value.id) || netUids.has(value.netUid)
      || BigInt(value.id) <= previous) return fail()
    // Encoder.Default can escape each UTF-16 code unit to six bytes. The server
    // additionally budgets both raw Name and FullName, so this public lower bound
    // cannot reject a server-admitted list after caption selection and trimming.
    conservativeBytes += 160 + 6 * (value.caption?.length ?? 0)
    if (conservativeBytes > 65536) return fail()
    previous = BigInt(value.id); ids.add(value.id); netUids.add(value.netUid)
    return { id: value.id, netUid: value.netUid, caption: value.caption }
  })
  return { type: 67, state: raw.state as 'known' | 'unavailable', values: [], inputSha256: raw.inputSha256, references }
}
