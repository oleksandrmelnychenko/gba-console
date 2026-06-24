import { describe, expect, it } from 'vitest'
import { getSyncTypeLabel } from '../syncHistoryLabels'

describe('SyncHistoryPanel type labels', () => {
  it('labels backend daily history records as daily sync, not a checkbox value', () => {
    expect(getSyncTypeLabel(7, 'daily')).toBe('Щоденна синхронізація')
  })

  it('keeps entity history mapped to entity sync options', () => {
    expect(getSyncTypeLabel(0, 'entity')).toBe('Товари')
    expect(getSyncTypeLabel(4, 'entity')).toBe('Грошові рахунки')
  })
})
