import { describe, expect, it } from 'vitest'
import { canDeletePricing, canEditPricing, isBusinessOrganizationVisible } from './clientResourcePolicies'

describe('client resource business policies', () => {
  it('keeps the five operational organizations and hides source-only stock references', () => {
    const names = [
      'ТОВ "Злагода Авто"',
      'ТОВ "ПАК "Конкорд"',
      'ТОВ "Хмельницький агрегатний завод" ',
      'ТОВ «АМГ «КОНКОРД»',
      'Фенікс',
      'ФОП БЕРЕШВІЛІ ВАДИМ ВІКТОРОВИЧ',
      'ФОП Пархоменко Ганна Юріївна',
      'ФОП Самолюк Алла Дмитрівна',
      'ФОП Самолюк Юрій Миколайович',
    ]

    expect(names.filter((Name) => isBusinessOrganizationVisible({ Name }))).toEqual([
      'ТОВ «АМГ «КОНКОРД»',
      'Фенікс',
      'ФОП Пархоменко Ганна Юріївна',
      'ФОП Самолюк Алла Дмитрівна',
      'ФОП Самолюк Юрій Миколайович',
    ])
  })

  it('does not hide locally created organizations merely because they are not on the source list', () => {
    expect(isBusinessOrganizationVisible({ Name: 'Нова локальна організація' })).toBe(true)
  })

  it('allows local pricing deletion and protects source-managed pricing from deletion', () => {
    expect(canDeletePricing({ IsSourceManaged: false })).toBe(true)
    expect(canDeletePricing({})).toBe(true)
    expect(canDeletePricing({ IsSourceManaged: true })).toBe(false)
  })

  it('allows markup edits only for calculated source-managed pricing', () => {
    expect(canEditPricing({ IsSourceManaged: false })).toBe(true)
    expect(canEditPricing({ BasePricingId: 849, IsSourceManaged: true })).toBe(true)
    expect(canEditPricing({ ExtraCharge: 30, IsSourceManaged: true })).toBe(true)
    expect(canEditPricing({ ExtraCharge: 0, IsSourceManaged: true })).toBe(false)
  })

  it('allows an AMG-only markup edit and every source-managed pricing once GBA owns pricing', () => {
    expect(canEditPricing({
      ExtraCharge: 0,
      IsSourceManaged: true,
      SourceDefinitions: [
        { BasePricingId: null, CalculatedExtraCharge: 0, ExtraCharge: 0, ForVat: false, ImportedForAmg: false },
        { BasePricingId: 849, CalculatedExtraCharge: 12, ExtraCharge: 12, ForVat: false, ImportedForAmg: true },
      ],
    })).toBe(true)
    expect(canEditPricing({ ExtraCharge: 0, IsSourceManaged: true, SourceFieldsEditable: true })).toBe(true)
  })
})
