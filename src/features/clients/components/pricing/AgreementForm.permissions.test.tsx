import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { Agreement, Pricing } from '../../types'
import { AgreementForm } from './AgreementForm'

const allowedPermissions = new Set<string>()

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

const pricings = [
  { ForVat: false, Id: 1, Name: 'Без ПДВ' },
  { ForVat: true, Id: 2, Name: 'З ПДВ' },
] as Pricing[]

function renderForm() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <AgreementForm
          agreement={{ WithVATAccounting: false } as Agreement}
          currencies={[]}
          isEdit={false}
          isProvider={false}
          isRetailClient
          isVatAccountingHidden={false}
          organizations={[]}
          pricings={pricings}
          promotionalPricings={[]}
          onChange={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('AgreementForm canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
  })

  it('hides or disables accounting settings without the granular key', () => {
    renderForm()

    expect(screen.queryByRole('checkbox', { name: 'Для перепродажу' })).toBeNull()
    expect((screen.getByRole('checkbox', { name: 'Облік з ПДВ' }) as HTMLInputElement).disabled).toBe(true)
  })

  it('enables accounting settings with their granular key', () => {
    allowedPermissions.add(PermissionKeys.Clients.Contract.AccountingSettingsEdit)
    renderForm()

    expect(screen.getByRole('checkbox', { name: 'Для перепродажу' })).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Облік з ПДВ' }) as HTMLInputElement).disabled).toBe(false)
  })

  it('shows out-of-scope retail pricing only with the override key', () => {
    const firstView = renderForm()
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип ціни' }))
    expect(screen.queryByRole('option', { name: 'З ПДВ' })).toBeNull()

    firstView.unmount()
    allowedPermissions.add(PermissionKeys.Clients.Contract.PricingScopeOverride)
    renderForm()
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип ціни' }))

    expect(screen.getByRole('option', { name: 'З ПДВ' })).toBeTruthy()
  })
})
