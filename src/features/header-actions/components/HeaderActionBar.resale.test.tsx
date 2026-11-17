import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { HeaderActionBar } from './HeaderActionBar'

const granted = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => granted.has(key) }),
}))
vi.mock('../../ai-fleet/components/AiFleetControl', () => ({ AiFleetControl: () => null }))
vi.mock('./ProductWriteOffRulesControl', () => ({ ProductWriteOffRulesControl: () => null }))
vi.mock('./SyncControl', () => ({ SyncControl: () => null }))
vi.mock('../../onec-export/components/OneCExportControl', () => ({ OneCExportControl: () => null }))

function renderWith(keys: string[]) {
  granted.clear()
  keys.forEach((key) => granted.add(key))
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <HeaderActionBar />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

const resaleButton = () => screen.queryByRole('button', { name: 'Перепродаж' })

describe('Resale header shortcut', () => {
  it('shows the shortcut with the header key and access to the Resale screen', () => {
    renderWith([PermissionKeys.OnlineShopSeo.Resale.Open, PermissionKeys.Resales.Page.View])
    expect(resaleButton()).not.toBeNull()
  })

  it('hides the shortcut without the header key', () => {
    renderWith([PermissionKeys.Resales.Page.View])
    expect(resaleButton()).toBeNull()
  })

  it('hides the shortcut when the Resale screen itself is not allowed', () => {
    renderWith([PermissionKeys.OnlineShopSeo.Resale.Open])
    expect(resaleButton()).toBeNull()
  })
})
