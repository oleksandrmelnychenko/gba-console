import { describe, expect, it } from 'vitest'
import { getBrokerServiceType } from './serviceTypeClassifier'

describe('serviceTypeClassifier', () => {
  it('classifies broker rows by matched custom organization before SupplyCustomType fallback', () => {
    expect(
      getBrokerServiceType(
        {
          CustomOrganization: { Name: 'ТОВ Митниця' },
          ExciseDutyOrganization: { Name: 'Акциз' },
          SupplyCustomType: 1,
        },
        { organizationName: ' тов митниця ' },
        2,
      ),
    ).toBe(2)
  })

  it('classifies broker rows by matched excise organization', () => {
    expect(
      getBrokerServiceType(
        {
          CustomOrganization: { Name: 'Митниця' },
          ExciseDutyOrganization: { Name: 'Акциз' },
        },
        { organizationName: 'Акциз' },
        2,
      ),
    ).toBe(3)
  })

  it('uses selected service type to resolve ambiguous organization matches', () => {
    const service = {
      CustomOrganization: { Name: 'Одна організація' },
      ExciseDutyOrganization: { Name: 'Одна організація' },
    }

    expect(getBrokerServiceType(service, { organizationName: 'Одна організація', serviceTypes: [2] }, 2)).toBe(2)
    expect(getBrokerServiceType(service, { organizationName: 'Одна організація', serviceTypes: [3] }, 2)).toBe(3)
  })

  it('falls back to SupplyCustomType when organization fields are absent', () => {
    expect(getBrokerServiceType({ SupplyCustomType: 1 }, {}, 2)).toBe(3)
    expect(getBrokerServiceType({}, {}, 2)).toBe(2)
  })
})
