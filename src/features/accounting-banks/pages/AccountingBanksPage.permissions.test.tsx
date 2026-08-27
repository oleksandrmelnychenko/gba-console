import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getAccountingBanks, saveAccountingBank } from '../api/accountingBanksApi'
import type { AccountingBank } from '../types'
import { AccountingBanksPage } from './AccountingBanksPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/accountingBanksApi', () => ({
  getAccountingBanks: vi.fn(),
  saveAccountingBank: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: DataTableColumn<AccountingBank>[]
    data: AccountingBank[]
    onRowClick?: (bank: AccountingBank) => void
  }) => (
    <div>
      {data.map((bank) => (
        <div key={bank.NetUid}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(bank)}>
            row-{bank.Name}
          </button>
          {columns.at(-1)?.cell?.(bank)}
        </div>
      ))}
    </div>
  ),
}))

const BANK: AccountingBank = {
  Address: 'Київ',
  City: 'Київ',
  EdrpouCode: '12345678',
  Id: 7,
  MfoCode: '300001',
  Name: 'Тест Банк',
  NetUid: 'bank-1',
  Phones: '123',
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter>
          <AccountingBanksPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('accounting bank canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getAccountingBanks).mockResolvedValue([BANK])
    vi.mocked(saveAccountingBank).mockResolvedValue([BANK])
  })

  it('does not mount the registry without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getAccountingBanks).not.toHaveBeenCalled()
  })

  it('keeps page-only access read-only', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Page.View)
    renderPage()

    const row = await screen.findByRole('button', { name: 'row-Тест Банк' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Новий банк' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
  })

  it('uses create for both the new-bank opener and final submit', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Page.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Bank.Create)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Новий банк' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Назва/ }), { target: { value: 'Новий банк' } })
    fireEvent.change(screen.getByRole('textbox', { name: /МФО/ }), { target: { value: '300002' } })
    fireEvent.change(screen.getByRole('textbox', { name: /ЄДРПОУ/ }), { target: { value: '87654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(saveAccountingBank).toHaveBeenCalledWith(expect.objectContaining({
      EdrpouCode: '87654321',
      MfoCode: '300002',
      Name: 'Новий банк',
    })))
  })

  it('uses save for both row editing and final update', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Page.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Bank.Save)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'row-Тест Банк' }))
    expect(screen.queryByRole('button', { name: 'Новий банк' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: /Назва/ }), { target: { value: 'Оновлений банк' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(saveAccountingBank).toHaveBeenCalledWith(expect.objectContaining({
      Id: 7,
      Name: 'Оновлений банк',
    })))
  })

  it('keeps delete independent from create and save', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Page.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.Banks.Bank.Delete)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(saveAccountingBank).toHaveBeenCalledWith({ ...BANK, Deleted: true }))
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })
})
