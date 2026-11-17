import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getCurrentEuroExchangeRate,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowUsers,
} from '../api/incomeCashflowsApi'
import { IncomeCashflowUserFormPage } from './IncomeCashflowUserFormPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  createIncomeCashflow: vi.fn(),
  getCurrentEuroExchangeRate: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
  searchIncomeCashflowUsers: vi.fn(),
}))

describe('Повернення від колеги: Колега', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([])
    vi.mocked(getIncomeCashflowPaymentMovements).mockResolvedValue([])
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValue([])
    vi.mocked(getCurrentEuroExchangeRate).mockResolvedValue(1)
    // The server finds "fin" but not the full label "QA finance".
    vi.mocked(searchIncomeCashflowUsers).mockImplementation(async (value) => (
      value === 'fin' ? [{ FirstName: 'QA', LastName: 'finance', Id: 7, NetUid: 'user-7' }] : []
    ))
  })

  it('keeps the picked colleague and does not search its label again', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/accounting/income-cashflows/new/user']}>
        <MantineProvider>
          <I18nProvider>
            <IncomeCashflowUserFormPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const select = await screen.findByRole('combobox', { name: /Колега/ })
    await waitFor(() => expect(select.hasAttribute('disabled')).toBe(false))
    await user.click(select)
    await user.type(select, 'fin')
    const option = await screen.findByRole('option', { hidden: true, name: /finance/ }, { timeout: 3000 })
    const label = option.textContent || ''
    await user.click(option)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })

    expect((select as HTMLInputElement).value).toBe(label)
    expect(vi.mocked(searchIncomeCashflowUsers).mock.calls.map(([value]) => value)).not.toContain(label)
  })
})
