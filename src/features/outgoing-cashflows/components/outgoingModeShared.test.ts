import { describe, expect, it } from 'vitest'
import { getOrganizationDisplayName } from '../../../shared/organizations/organizationDisplayName'
import { toEntityOptions } from './outgoingModeShared'

const organization = {
  NetUid: 'org-amg',
  Name: 'ТОВ «АМГ «КОНКОРД»',
  FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "АВТОМОБІЛЬНА МОТОРИЗАЦІЙНА ГРУПА "КОНКОРД"',
}

describe('outgoing entity options', () => {
  it('labels organizations with the short name when given the organization label', () => {
    expect(toEntityOptions([organization], getOrganizationDisplayName)).toEqual([
      { label: 'ТОВ «АМГ «КОНКОРД»', value: 'org-amg' },
    ])
  })

  it('keeps the full-name label for other entities by default', () => {
    expect(toEntityOptions([{ NetUid: 'client-1', Name: 'Клієнт', FullName: 'Клієнт ТОВ' }])).toEqual([
      { label: 'Клієнт ТОВ', value: 'client-1' },
    ])
  })
})
