import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { incomeCashflowFormRoute } from './incomeCashflowFormRoute'

const granted = new Set<string>()

vi.mock('../../features/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (key: string) => granted.has(key),
    cannot: (key: string) => !granted.has(key),
    isLoading: false,
    permissions: [...granted],
  }),
}))

function renderForm(keys: string[]) {
  granted.clear()
  keys.forEach((key) => granted.add(key))
  return render(
    <MantineProvider>
      <I18nProvider>{incomeCashflowFormRoute(<div>income form</div>)}</I18nProvider>
    </MantineProvider>,
  )
}

describe('income cash-flow create forms', () => {
  it('are denied without the income cash-flows page key', () => {
    renderForm([PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateOtherIncome])
    expect(screen.getByText('Доступ заборонено')).not.toBeNull()
    expect(screen.queryByText('income form')).toBeNull()
  })

  it('render with the page key', async () => {
    renderForm([PermissionKeys.SystemPages.IncomeCashflows.View])
    expect(await screen.findByText('income form')).not.toBeNull()
  })
})
