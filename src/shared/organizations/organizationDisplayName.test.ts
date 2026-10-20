import { describe, expect, it } from 'vitest'
import { getOrganizationDisplayName } from './organizationDisplayName'

const amgShortName = 'ТОВ «АМГ «КОНКОРД»'
const amgFullName = 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "АВТОМОБІЛЬНА МОТОРИЗАЦІЙНА ГРУПА "КОНКОРД"'

describe('organization display name', () => {
  it('shows the short organization name even when the legal full name is present', () => {
    expect(getOrganizationDisplayName({ Name: amgShortName, FullName: amgFullName })).toBe(amgShortName)
  })

  it('trims the short name', () => {
    expect(getOrganizationDisplayName({ Name: `  ${amgShortName} `, FullName: amgFullName })).toBe(amgShortName)
  })

  it('uses a culture short name before the legal full name when the resolved name is blank', () => {
    expect(getOrganizationDisplayName({ Name: ' ', NameUk: amgShortName, FullName: amgFullName })).toBe(amgShortName)
    expect(getOrganizationDisplayName({ Name: null, NamePl: amgShortName, FullName: amgFullName })).toBe(amgShortName)
  })

  it('falls back to the legal full name only when no short name exists', () => {
    expect(getOrganizationDisplayName({ Name: '', FullName: amgFullName })).toBe(amgFullName)
  })

  it('returns an empty string for a missing organization', () => {
    expect(getOrganizationDisplayName(null)).toBe('')
    expect(getOrganizationDisplayName(undefined)).toBe('')
    expect(getOrganizationDisplayName({})).toBe('')
  })
})
