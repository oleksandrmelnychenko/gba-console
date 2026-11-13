import { procurementQuantityFormat } from './procurementQuantityFormat'
import type { ReorderSuggestion } from './procurementTypes'

export type ProcurementOrderTermMarker = {
  kind: 'moq' | 'pack'
  label: string
  tooltip: string | null
}

type OrderTermLine = Pick<
  ReorderSuggestion,
  'suggested_qty' | 'raw_qty' | 'moq' | 'order_multiple' | 'moq_basis' | 'moq_evidence' | 'pack_multiple' | 'measure_unit'
>

const dateFormat = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const countFormat = new Intl.NumberFormat('uk-UA')

function formatEvidenceDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date)
}

export function describeMoqEvidence(line: OrderTermLine): string | null {
  if (line.moq_basis === 'buyer') return 'задано закупником'
  if (line.moq_basis !== 'derived_validated') return null
  const evidence = line.moq_evidence
  const moq = line.moq
  if (!evidence || moq == null) return 'Найменша партія в накладних постачальника'
  const atMinimum = evidence.quantities.filter((quantity) => quantity === moq).length
  const countIsExact = atMinimum > 0 && (atMinimum < evidence.quantities.length || evidence.quantities.length >= evidence.documents)
  const batch = procurementQuantityFormat.format(moq)
  const total = countFormat.format(evidence.documents)
  const parts = [
    !countIsExact
      ? `${batch}, усього ${total} док.`
      : atMinimum === evidence.documents
        ? `${batch} × ${total} док.`
        : `${batch} × ${countFormat.format(atMinimum)} док. із ${total}`,
  ]
  const date = formatEvidenceDate(evidence.source_document_date)
  if (date) parts.push(`остання ${date}`)
  const unit = line.measure_unit?.trim() || 'од.'
  return `Найменша партія в накладних постачальника: ${parts.join(', ')}; продажі за 12 міс.: ${procurementQuantityFormat.format(evidence.sales_12m_units)} ${unit}`
}

export function procurementOrderTermMarkers(line: OrderTermLine): ProcurementOrderTermMarker[] {
  const raw = line.raw_qty
  if (raw == null || !(line.suggested_qty > raw)) return []
  const markers: ProcurementOrderTermMarker[] = []
  if (line.moq != null && line.moq > 0 && raw < line.moq) {
    markers.push({
      kind: 'moq',
      label: `мін. партія ${procurementQuantityFormat.format(line.moq)}`,
      tooltip: describeMoqEvidence(line),
    })
  }
  const pack = line.pack_multiple ?? line.order_multiple
  if (pack != null && pack > 0 && pack !== 1) {
    markers.push({
      kind: 'pack',
      label: `кратність ${procurementQuantityFormat.format(pack)}`,
      tooltip: 'Кількість округлено вгору до кратності упаковки',
    })
  }
  return markers
}
