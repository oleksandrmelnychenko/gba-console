import { describe, expect, it } from 'vitest'
import { consignmentNoteSettingLabel } from './consignmentNoteSettingLabel'

describe('consignmentNoteSettingLabel', () => {
  it('uses the setting name', () => {
    expect(consignmentNoteSettingLabel({ Name: ' QA2 TTN Львів ', Driver: 'QA Водій' })).toBe('QA2 TTN Львів')
  })

  it('names a nameless setting after its data', () => {
    expect(consignmentNoteSettingLabel({ Name: null, Number: '123', BrandAndNumberCar: 'AA1234BB', LoadingPoint: 'Львів' }))
      .toBe('Без назви (№ 123, AA1234BB, Львів)')
  })

  it('hides an empty template (nothing to apply)', () => {
    expect(consignmentNoteSettingLabel({ Name: null })).toBeNull()
    expect(consignmentNoteSettingLabel({ Name: '  ', Number: '', Driver: ' ' })).toBeNull()
  })
})
