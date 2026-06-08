import { describe, expect, it } from 'vitest'
import {
  getProtocolPlacementStatusLabel,
  getProtocolStatusActionLabel,
  getProtocolStatusLabel,
} from './protocolStatus'

const t = (value: string) => value

describe('protocol status labels', () => {
  it('shows in-transit status before shipment', () => {
    expect(getProtocolStatusLabel({ IsCompleted: false, IsShipped: false }, t)).toBe('В дорозі')
  })

  it('shows arrived status after shipment', () => {
    expect(getProtocolStatusLabel({ IsCompleted: false, IsShipped: true }, t)).toBe('Прибув')
  })

  it('shows final state for completed protocols', () => {
    expect(getProtocolStatusLabel({ IsCompleted: true, IsShipped: true }, t)).toBe('Завершено')
  })

  it('prioritizes completed state even when shipped flag is absent', () => {
    expect(getProtocolStatusLabel({ IsCompleted: true }, t)).toBe('Завершено')
  })

  it('keeps a separate action label helper for the status button', () => {
    expect(getProtocolStatusActionLabel({ IsCompleted: false, IsShipped: true }, t)).toBe('Прибув')
  })
})

describe('protocol placement status labels', () => {
  it('shows not placed status before product income', () => {
    expect(getProtocolPlacementStatusLabel({ IsPartiallyPlaced: false, IsPlaced: false }, t)).toBe('Не оприходуваний')
  })

  it('shows partial placement status', () => {
    expect(getProtocolPlacementStatusLabel({ IsPartiallyPlaced: true, IsPlaced: false }, t)).toBe('Частково оприходуваний')
  })

  it('shows placed status and prioritizes it over partial flag', () => {
    expect(getProtocolPlacementStatusLabel({ IsPartiallyPlaced: true, IsPlaced: true }, t)).toBe('Оприходуваний')
  })
})
