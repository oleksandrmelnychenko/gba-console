import { describe, expect, it } from 'vitest'
import { isNavigationPathAllowed, normalizeNavigation } from './navigationUtils'

const servicesModule = {
  Id: 25,
  Module: 'Послуги',
  Children: [{ Id: 49, Module: 'Постачальники послуг', Route: '/accounting/supplier-organizations', Children: [] }],
}

describe('Організації послуг in the menu', () => {
  it('is added next to «Постачальники послуг» for a role with services.organisations.page.view', () => {
    const modules = normalizeNavigation([servicesModule], { includeServiceOrganisations: true })

    expect(modules[0].Children.map((node) => node.Route)).toContain('/service/organisations')
    expect(isNavigationPathAllowed(modules, '/service/organisations')).toBe(true)
  })

  it('stays out of the menu and the route guard without the key', () => {
    const modules = normalizeNavigation([servicesModule])

    expect(modules[0].Children.map((node) => node.Route)).not.toContain('/service/organisations')
    expect(isNavigationPathAllowed(modules, '/service/organisations')).toBe(false)
  })
})
