import { unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent, type ApiStreamSession } from '../../../shared/api/apiStreamClient'
import { invalidTemplateOrder, normalizeTemplateOrder, templateOrderRequest, type ReportTemplateOrderCommand } from '../data/reportTemplateOrder'

export type ReportTemplateOrderContext = { session: ApiStreamSession; signal: AbortSignal }
const maximumBytes = 256 * 1024

/** Only bounded metadata; reject duplicate properties and numeric tokens that would round before validation. */
function parseMetadata(text: string): unknown {
  let index = 0
  const space = () => { while (/[ \t\r\n]/.test(text[index] ?? '') && index < text.length) index++ }
  const string = () => {
    const start = index++
    while (index < text.length && text[index] !== '"') { if (text[index++] === '\\') index++ }
    if (index >= text.length || index - start > 24578) throw invalidTemplateOrder()
    return JSON.parse(text.slice(start, ++index)) as string
  }
  const value = (depth: number): unknown => {
    space(); if (depth > 6) throw invalidTemplateOrder()
    const char = text[index]
    if (char === '"') return string()
    if (char === '{' || char === '[') {
      const object = char === '{', end = object ? '}' : ']'
      const result: Record<string, unknown> | unknown[] = object ? Object.create(null) as Record<string, unknown> : []
      const names = new Set<string>(); let count = 0
      index++; space()
      if (text[index] === end) { index++; return result }
      while (true) {
        space(); if (++count > (object ? 12 : 200)) throw invalidTemplateOrder()
        if (object) {
          if (text[index] !== '"') throw invalidTemplateOrder()
          const name = string(); if (names.has(name)) throw invalidTemplateOrder(); names.add(name)
          space(); if (text[index++] !== ':') throw invalidTemplateOrder()
          const properties = result as Record<string, unknown>
          properties[name] = value(depth + 1)
        } else (result as unknown[]).push(value(depth + 1))
        space(); const next = text[index++]; if (next === end) return result
        if (next !== ',') throw invalidTemplateOrder()
      }
    }
    for (const literal of ['null', 'true', 'false']) if (text.startsWith(literal, index)) {
      index += literal.length; return literal === 'null' ? null : literal === 'true'
    }
    const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index))?.[0]
    if (!token || !/^(?:0|[1-9]\d*)$/.test(token) || !Number.isSafeInteger(Number(token))) throw invalidTemplateOrder()
    index += token.length; return Number(token)
  }
  const result = value(0); space(); if (index !== text.length) throw invalidTemplateOrder()
  return result
}

async function readState(response: Response, signal: AbortSignal) {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidTemplateOrder()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  let count = 0, text = ''
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      assertApiStreamCurrent(response, signal)
      const next = await reader.read()
      assertApiStreamCurrent(response, signal)
      if (next.done) break
      if (next.value.byteLength > maximumBytes - count) throw invalidTemplateOrder()
      count += next.value.byteLength; text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode()
    const state = normalizeTemplateOrder(unwrapApiResponse<unknown>(parseMetadata(text)))
    assertApiStreamCurrent(response, signal); return state
  } catch (error) {
    // Keep cancellation/authentication isolation; malformed metadata has a plain recovery message.
    assertApiStreamCurrent(response, signal)
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw invalidTemplateOrder()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}

async function requestState(path: string, context: ReportTemplateOrderContext, body?: string) {
  const response = await apiRequestStream(path, { ...context, method: body === undefined ? 'GET' : 'POST', body })
  try { return await readState(response, context.signal) }
  finally { void response.body?.cancel().catch(() => undefined) }
}

export const getReportTemplateOrderState = (context: ReportTemplateOrderContext) => requestState('/report/templates/order-state', context)
export async function orderReportTemplates(command: ReportTemplateOrderCommand, expectedListRevision: number, context: ReportTemplateOrderContext) {
  const body = templateOrderRequest({ ...command }, expectedListRevision)
  const state = await requestState('/report/templates/order', context, JSON.stringify(body))
  if (state.ListRevision !== expectedListRevision + 1) throw invalidTemplateOrder()
  return state
}
