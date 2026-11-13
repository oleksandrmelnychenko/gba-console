import { describe, expect, it } from 'vitest'
import { describeMoqEvidence, procurementOrderTermMarkers } from './procurementOrderTerm'

const base = {
  suggested_qty: 50,
  raw_qty: 7,
  moq: 50,
  order_multiple: null,
  pack_multiple: null,
  moq_basis: 'derived_validated' as const,
  moq_evidence: { documents: 9, quantities: [50, 50, 50, 50, 50, 50, 50, 50, 50], source_document_date: '2026-08-06', sales_12m_units: 138 },
}

describe('procurementOrderTermMarkers', () => {
  it('marks a quantity raised to the smallest batch and explains it from the evidence', () => {
    expect(procurementOrderTermMarkers(base)).toEqual([
      {
        kind: 'moq',
        label: 'мін. партія 50',
        tooltip: 'Найменша партія в накладних постачальника: 50 × 9 док., остання 06.08.2026; продажі за 12 міс.: 138 од.',
      },
    ])
  })

  it('names a term the buyer set', () => {
    const [marker] = procurementOrderTermMarkers({ ...base, moq_basis: 'buyer', moq_evidence: null })
    expect(marker.label).toBe('мін. партія 50')
    expect(marker.tooltip).toBe('задано закупником')
  })

  it('adds the pack multiple when the quantity was rounded up', () => {
    const markers = procurementOrderTermMarkers({ ...base, suggested_qty: 8, raw_qty: 7, moq: null, pack_multiple: 2, order_multiple: 2 })
    expect(markers.map((marker) => marker.label)).toEqual(['кратність 2'])
    const both = procurementOrderTermMarkers({ ...base, pack_multiple: 2 })
    expect(both.map((marker) => marker.label)).toEqual(['мін. партія 50', 'кратність 2'])
  })

  it('falls back to the older order_multiple field', () => {
    const markers = procurementOrderTermMarkers({ ...base, suggested_qty: 10, raw_qty: 7, moq: null, order_multiple: 5 })
    expect(markers.map((marker) => marker.label)).toEqual(['кратність 5'])
  })

  it('stays silent when the term did not raise the quantity', () => {
    expect(procurementOrderTermMarkers({ ...base, raw_qty: null })).toEqual([])
    expect(procurementOrderTermMarkers({ ...base, suggested_qty: 60, raw_qty: 75 })).toEqual([])
    expect(procurementOrderTermMarkers({ ...base, suggested_qty: 80, raw_qty: 75, pack_multiple: 1 })).toEqual([])
  })

  it('keeps the marker without a tooltip for an older service', () => {
    const [marker] = procurementOrderTermMarkers({ ...base, moq_basis: null, moq_evidence: null })
    expect(marker).toEqual({ kind: 'moq', label: 'мін. партія 50', tooltip: null })
  })
})

describe('describeMoqEvidence', () => {
  it('counts the documents at the smallest batch among all supplier documents', () => {
    const evidence = { documents: 64, quantities: [20, 20, 40, 50, 100], source_document_date: '2026-04-06', sales_12m_units: 1985 }
    expect(describeMoqEvidence({ ...base, moq: 20, measure_unit: 'шт', moq_evidence: evidence })?.replace(/\s/g, ' '))
      .toBe('Найменша партія в накладних постачальника: 20 × 2 док. із 64, остання 06.04.2026; продажі за 12 міс.: 1 985 шт')
  })

  it('does not guess the count when the quantity list is cut short or missing', () => {
    const evidence = { documents: 64, quantities: [20, 20], source_document_date: '2026-04-06', sales_12m_units: 30 }
    expect(describeMoqEvidence({ ...base, moq: 20, moq_evidence: evidence }))
      .toBe('Найменша партія в накладних постачальника: 20, усього 64 док., остання 06.04.2026; продажі за 12 міс.: 30 од.')
    expect(describeMoqEvidence({ ...base, moq: 20, moq_evidence: { ...evidence, quantities: [] } }))
      .toContain('20, усього 64 док.')
  })

  it('survives evidence without a readable date', () => {
    expect(describeMoqEvidence({ ...base, moq_evidence: { ...base.moq_evidence, source_document_date: 'n/a' } }))
      .toBe('Найменша партія в накладних постачальника: 50 × 9 док.; продажі за 12 міс.: 138 од.')
    expect(describeMoqEvidence({ ...base, moq_evidence: null })).toBe('Найменша партія в накладних постачальника')
  })
})
