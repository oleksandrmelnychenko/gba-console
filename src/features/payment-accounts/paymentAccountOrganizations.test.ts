// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Новий рахунок > Організація', () => {
  it('lists organizations by name and leaves nameless ones (shown as GUIDs) out', () => {
    const source = readFileSync('src/features/payment-accounts/pages/PaymentAccountFormPage.tsx', 'utf8') as string
    const options = source.slice(source.indexOf('const organizationOptions = useMemo('), source.indexOf('const bankOptions = useMemo('))

    expect(options).toContain('Boolean(getOrganizationDisplayName(organization))')
    expect(options).not.toContain('organization.Name || organization.FullName')
  })
})
