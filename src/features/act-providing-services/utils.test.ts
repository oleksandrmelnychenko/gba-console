import { describe, expect, it } from 'vitest'
import { toActProvidingServiceDisplayModel } from './utils'

const organization = {
  Name: 'ТОВ «АМГ «КОНКОРД»',
  FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "АВТОМОБІЛЬНА МОТОРИЗАЦІЙНА ГРУПА "КОНКОРД"',
}
const translate = (key: string) => key

describe('act providing service display model', () => {
  it('shows the short organization name for merged services', () => {
    const model = toActProvidingServiceDisplayModel({ MergedService: { SupplyOrganizationAgreement: { Organization: organization } } }, translate)

    expect(model.organization).toBe('ТОВ «АМГ «КОНКОРД»')
  })

  it('shows the short organization name for bill of lading services', () => {
    const model = toActProvidingServiceDisplayModel({ BillOfLadingService: { SupplyOrganizationAgreement: { Organization: organization } } }, translate)

    expect(model.organization).toBe('ТОВ «АМГ «КОНКОРД»')
  })

  it('shows the short organization name for delivery expenses', () => {
    const model = toActProvidingServiceDisplayModel({ DeliveryExpense: { SupplyOrderUkraine: { Organization: organization } } }, translate)

    expect(model.organization).toBe('ТОВ «АМГ «КОНКОРД»')
  })
})
