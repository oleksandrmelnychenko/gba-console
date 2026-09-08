/** Bounded original-byte JSON transport. No numbers are converted while scanning. */
export type RegisterJsonInput = Uint8Array | ReadableStream<Uint8Array>
export interface RegisterJsonOptions { readonly maximumBytes?: number; readonly signal?: AbortSignal }
export type JsonSpan = readonly [start: number, end: number]
export class RegisterJsonError extends Error {
  readonly code: 'bytes' | 'utf8' | 'syntax' | 'duplicate' | 'depth' | 'string' | 'shape' | 'budget' | 'binding'
  constructor(code: RegisterJsonError['code']) {
    super(`Некоректні або надмірні дані звіту (${code}).`)
    this.code = code
    this.name = 'RegisterJsonError'
  }
}
export function invalidJson(code: RegisterJsonError['code']): never { throw new RegisterJsonError(code) }
const typedArrayTag = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag)!.get!
function byteArray(value: unknown): value is Uint8Array {
  // The intrinsic brand works across browser realms and cannot be replaced by an own toStringTag.
  return ArrayBuffer.isView(value) && typedArrayTag.call(value) === 'Uint8Array'
}

export async function readBoundedRegisterBytes(input: RegisterJsonInput, fallback: number, hardMaximum: number, options: RegisterJsonOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const maximum = options.maximumBytes ?? fallback
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > hardMaximum) invalidJson('bytes')
  options.signal?.throwIfAborted()
  if (byteArray(input)) {
    if (!input.byteLength || input.byteLength > maximum) invalidJson('bytes')
    return new Uint8Array(input)
  }
  const reader = input.getReader()
  let buffer = new Uint8Array(Math.min(maximum, 16384))
  let length = 0, complete = false
  const abort = () => { void reader.cancel().catch(() => undefined) }
  options.signal?.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      options.signal?.throwIfAborted()
      const next = await reader.read()
      options.signal?.throwIfAborted()
      if (next.done) break
      const chunk = next.value
      if (!byteArray(chunk)) invalidJson('bytes')
      const chunkLength = chunk.byteLength
      if (chunkLength > maximum - length) invalidJson('bytes')
      // A single growing buffer also bounds overhead for streams emitting one byte per chunk.
      if (length + chunkLength > buffer.length) {
        const larger = new Uint8Array(Math.min(maximum, Math.max(length + chunkLength, buffer.length * 2)))
        larger.set(buffer.subarray(0, length)); buffer = larger
      }
      buffer.set(chunk, length)
      length += chunkLength
    }
    if (!length) invalidJson('bytes')
    complete = true
    return buffer.slice(0, length)
  } finally {
    options.signal?.removeEventListener('abort', abort)
    if (!complete) void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function validUnicode(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (c >= 0xdc00 && c <= 0xdfff) return false
  }
  return true
}

/** Input is strict UTF-8 or decoded JSON string text; this counts bytes, not operands. */
function byteLength(text: string, start: number, end: number): number {
  let length = 0
  for (let i = start; i < end; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x80) length++
    else if (c < 0x800) length += 2
    else if (c >= 0xd800 && c <= 0xdbff) { length += 4; i++ }
    else length += 3
  }
  return length
}

/** Keeps source spans, never a complete object graph. Individual strings are bounded before decoding. */
export class BoundedJsonDocument {
  readonly root: JsonSpan
  private readonly text: string
  private readonly signal?: AbortSignal
  constructor(bytes: Uint8Array, signal?: AbortSignal) {
    this.signal = signal
    signal?.throwIfAborted()
    if (!byteArray(bytes) || bytes.byteLength > 536_870_912) invalidJson('bytes')
    if (!bytes.length || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) invalidJson('utf8')
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true }), parts: string[] = []
      for (let offset = 0; offset < bytes.length; offset += 4096) {
        signal?.throwIfAborted()
        parts.push(decoder.decode(bytes.subarray(offset, offset + 4096), { stream: true }))
      }
      parts.push(decoder.decode())
      this.text = parts.join('')
    } catch (error) {
      signal?.throwIfAborted()
      if (error instanceof RegisterJsonError) throw error
      invalidJson('utf8')
    }
    const start = this.space(0), end = this.value(start, 0)
    if (this.space(end) !== this.text.length) invalidJson('syntax')
    this.root = [start, end]
  }
  private space(index: number): number {
    while (index < this.text.length && (this.text[index] === ' ' || this.text[index] === '\t' || this.text[index] === '\r' || this.text[index] === '\n')) index++
    return index
  }
  private string(start: number, name: boolean): { end: number; value: string } {
    if (this.text[start] !== '"') invalidJson('syntax')
    const maximum = name ? 128 : 4096
    let end = start + 1
    for (; end < this.text.length; end++) {
      if (end - start - 1 > maximum * 6) invalidJson('string')
      const char = this.text[end]
      if (char === '"') break
      if (char === '\\') end++
      else if (this.text.charCodeAt(end) < 32) invalidJson('syntax')
    }
    if (end >= this.text.length) invalidJson('syntax')
    if (byteLength(this.text, start + 1, end) > maximum * 6) invalidJson('string')
    let value: unknown
    try { value = JSON.parse(this.text.slice(start, end + 1)) } catch { invalidJson('syntax') }
    if (typeof value !== 'string' || value.length > maximum || !validUnicode(value)) invalidJson('string')
    return { end: end + 1, value }
  }
  private value(start: number, depth: number, member?: string): number {
    this.signal?.throwIfAborted()
    const char = this.text[start]
    if (char === '"') return this.string(start, false).end
    if (char === '{' || char === '[') {
      if (depth >= 16) invalidJson('depth')
      let index = this.space(start + 1), count = 0
      const close = char === '{' ? '}' : ']', names = new Set<string>()
      if (this.text[index] === close) return index + 1
      while (true) {
        let name: string | undefined
        if (char === '{') {
          if (++count > 12) invalidJson('shape')
          const property = this.string(index, true)
          name = property.value
          if (names.has(name)) invalidJson('duplicate')
          names.add(name)
          index = this.space(property.end)
          if (this.text[index] !== ':') invalidJson('syntax')
          index = this.space(index + 1)
        } else if (++count > 1_000_000) invalidJson('budget')
        index = this.space(this.value(index, depth + 1, name))
        if (this.text[index] === close) return index + 1
        if (this.text[index] !== ',') invalidJson('syntax')
        index = this.space(index + 1)
      }
    }
    for (const literal of ['true', 'false', 'null']) if (this.text.startsWith(literal, start)) return start + literal.length
    // The wire has exactly one numeric token: each envelope's literal version 1.
    if (char === '1' && member === 'version') return start + 1
    invalidJson('syntax')
  }
  members(span: JsonSpan, expected?: readonly string[]): ReadonlyMap<string, JsonSpan> {
    if (this.text[span[0]] !== '{') invalidJson('shape')
    const result = new Map<string, JsonSpan>()
    const expectedNames = expected ? new Set(expected) : undefined
    let index = this.space(span[0] + 1)
    while (this.text[index] !== '}') {
      const name = this.string(index, true)
      index = this.space(name.end)
      if (this.text[index] !== ':') invalidJson('syntax')
      const start = this.space(index + 1), end = this.value(start, 0, name.value)
      if ((expectedNames && !expectedNames.has(name.value)) || result.has(name.value)) invalidJson('shape')
      result.set(name.value, [start, end])
      index = this.space(end)
      if (this.text[index] === '}') break
      if (this.text[index] !== ',') invalidJson('syntax')
      index = this.space(index + 1)
    }
    if (index + 1 !== span[1] || (expected && result.size !== expected.length)) invalidJson('shape')
    return result
  }
  * elements(span: JsonSpan, maximum: number): Generator<JsonSpan> {
    if (this.text[span[0]] !== '[') invalidJson('shape')
    let index = this.space(span[0] + 1), count = 0
    while (this.text[index] !== ']') {
      if (++count > maximum) invalidJson('budget')
      const end = this.value(index, 0)
      yield [index, end]
      index = this.space(end)
      if (this.text[index] === ']') break
      if (this.text[index] !== ',') invalidJson('syntax')
      index = this.space(index + 1)
    }
    if (index + 1 !== span[1]) invalidJson('shape')
  }
  bounded(span: JsonSpan, maximumBytes: number): void {
    if (span[1] - span[0] > maximumBytes || byteLength(this.text, span[0], span[1]) > maximumBytes) invalidJson('bytes')
  }
  materialize(span: JsonSpan, maximumBytes: number): unknown {
    this.signal?.throwIfAborted()
    this.bounded(span, maximumBytes)
    return JSON.parse(this.text.slice(span[0], span[1])) as unknown
  }
  scalar(span: JsonSpan): unknown {
    if (this.text[span[0]] === '{' || this.text[span[0]] === '[') invalidJson('shape')
    return this.materialize(span, 4096 * 6 + 2)
  }
}
