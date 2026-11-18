import { describe, expect, it } from 'vitest'
import { getOrganizationDisplayName, withNamedOrganizations } from './organizationDisplayName'

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

// N3-07: the cash-order forms offered 8 nameless organizations as bare GUIDs.
describe('withNamedOrganizations', () => {
  const named = { Id: 1, NetUid: 'org-1', Name: 'QA ТОВ Тест Україна' }
  const nameless = { Id: 2, NetUid: '55d561d0-0000-4000-8000-000000000002', Name: null, FullName: ' ' }

  it('leaves out organizations without any name', () => {
    expect(withNamedOrganizations([named, nameless])).toEqual([named])
  })

  it('keeps the organization the form already uses', () => {
    expect(withNamedOrganizations([named, nameless], nameless.NetUid)).toEqual([named, nameless])
    expect(withNamedOrganizations([named, nameless], '2')).toEqual([named, nameless])
  })

  it.each([
    'src/features/income-cashflows/pages/IncomeCashflowClientFormPage.tsx',
    'src/features/income-cashflows/pages/IncomeCashflowConversionFormPage.tsx',
    'src/features/income-cashflows/pages/IncomeCashflowShopFormPage.tsx',
    'src/features/income-cashflows/pages/IncomeCashflowUserFormPage.tsx',
    'src/features/outgoing-cashflows/components/OutgoingCashOrderForm.tsx',
    'src/features/outgoing-cashflows/components/OutgoingPaymentGroupForm.tsx',
  ])('%s offers named organizations only', async (path) => {
    // @ts-expect-error Keep the Node type scope out of the application compilation unit.
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(path, 'utf8') as string
    const options = source.slice(source.indexOf('const organizationOptions = useMemo('))
    expect(options.slice(0, 200)).toContain('withNamedOrganizations(')
    // The preselected organization is a named one too.
    expect(source).not.toMatch(/defaultOrganization = \(?nextOrganizations\[0\]/)
  })
})
