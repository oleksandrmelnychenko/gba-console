import { describe, expect, it } from 'vitest'
import {
  getProtocolPlacementStatusLabel,
  getProtocolStatusActionLabel,
  getProtocolStatusLabel,
} from './protocolStatus'

const t = (value: string) => value

describe('protocol status labels', () => {
  it('shows created status before the protocol is sent in transit', () => {
    expect(getProtocolStatusLabel({ IsCompleted: false, IsShipped: false }, t)).toBe('Створено')
  })

  it('keeps the current status in transit until arrival is confirmed', () => {
    expect(getProtocolStatusLabel({ IsCompleted: false, IsShipped: true }, t)).toBe('В дорозі')
  })

  it('shows final state for completed protocols', () => {
    expect(getProtocolStatusLabel({ IsCompleted: true, IsShipped: true }, t)).toBe('Завершено')
  })

  it('prioritizes completed state even when shipped flag is absent', () => {
    expect(getProtocolStatusLabel({ IsCompleted: true }, t)).toBe('Завершено')
  })

  it('shows arrival as the next action after transit starts', () => {
    expect(getProtocolStatusActionLabel({ IsCompleted: false, IsShipped: true }, t)).toBe('Прибув')
  })

  it('shows transit as the first status action', () => {
    expect(getProtocolStatusActionLabel({ IsCompleted: false, IsShipped: false }, t)).toBe('В дорозі')
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
