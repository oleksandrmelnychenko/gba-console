import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { createStockReport } from '../api/reportsApi'
import { ReportsStocksPage } from './ReportsStocksPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/reportsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

describe('stock report permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('fails closed at submit when generate permission is absent', () => {
    const { container } = render(
      <Providers>
        <ReportsStocksPage />
      </Providers>,
    )

    const submit = screen.getByRole('button', { name: 'Сформувати' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.getAttribute('title')).toBe(
      'Немає права формувати звіт залишків',
    )

    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it('keeps report validation independent after generate is granted', () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)

    render(
      <Providers>
        <ReportsStocksPage />
      </Providers>,
    )

    const submit = screen.getByRole('button', { name: 'Сформувати' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.getAttribute('title')).toBe(
      'Виберіть хоча б один показник',
    )
  })
})
