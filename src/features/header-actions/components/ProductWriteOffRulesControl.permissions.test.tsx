import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductWriteOffBaseRules } from '../api/productWriteOffRulesApi'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'

const granted = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (key: string) => granted.has(key),
    isAuthenticated: true,
    session: { csrfToken: 'csrf' },
  }),
}))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../api/productWriteOffRulesApi', () => ({
  getProductWriteOffBaseRules: vi.fn(),
  deleteProductWriteOffRule: vi.fn(),
}))

async function openWithRules(keys: string[]) {
  granted.clear()
  keys.forEach((key) => granted.add(key))
  vi.mocked(getProductWriteOffBaseRules).mockResolvedValue([{ NetUid: 'rule-1', RuleLocale: 'uk', RuleType: 0 }])
  render(
    <MantineProvider>
      <I18nProvider>
        <ProductWriteOffRulesControl />
      </I18nProvider>
    </MantineProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Глобальні правила списання' }))
  await screen.findAllByText(/./, { selector: '.write-off-rule-row *' })
}

describe('global write-off rules popover', () => {
  it('shows the delete action only with products.assortment.write_off_rules.delete', async () => {
    await openWithRules([PermissionKeys.ProductsAssortment.WriteOffRules.Delete])
    expect(screen.getAllByLabelText('Видалити')).toHaveLength(1)
  })

  it('lists rules read-only without the delete key', async () => {
    await openWithRules([])
    expect(screen.queryAllByLabelText('Видалити')).toHaveLength(0)
  })
})
