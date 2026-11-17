import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductWriteOffBaseRules } from '../api/productWriteOffRulesApi'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, isAuthenticated: true, session: { csrfToken: 'csrf' } }),
}))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../api/productWriteOffRulesApi', () => ({
  getProductWriteOffBaseRules: vi.fn(),
  deleteProductWriteOffRule: vi.fn(),
}))

it('closes on Escape while focus is on the trigger and keeps its name when a rule badge is shown', async () => {
  vi.mocked(getProductWriteOffBaseRules).mockResolvedValue([{ NetUid: 'rule-1', RuleLocale: 'uk', RuleType: 0 }])
  render(<MantineProvider env="test"><I18nProvider><ProductWriteOffRulesControl /></I18nProvider></MantineProvider>)

  const trigger = screen.getByRole('button', { name: 'Глобальні правила списання' })
  trigger.focus()
  fireEvent.click(trigger)
  await waitFor(() => expect(document.querySelector('.write-off-rule-row')).not.toBeNull())
  expect(screen.getByRole('button', { name: 'Глобальні правила списання' })).toBe(trigger)

  fireEvent.keyDown(trigger, { key: 'Escape' })

  await waitFor(() => expect(document.querySelector('.write-off-rule-row')).toBeNull())
})
