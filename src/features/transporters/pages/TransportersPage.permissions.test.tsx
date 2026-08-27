import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  archiveTransporter,
  createTransporter,
  getTransportersByType,
  getTransporterTypes,
  updateTransporter,
} from '../api/transportersApi'
import type { Transporter } from '../types'
import { TransportersPage } from './TransportersPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/transportersApi', () => ({
  archiveTransporter: vi.fn(),
  createTransporter: vi.fn(),
  getTransportersByType: vi.fn(),
  getTransporterTypes: vi.fn(),
  updateTransporter: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) => (
    opened ? <section>{title}{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: Transporter[]
    onRowClick?: (row: Transporter) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button
          disabled={!onRowClick}
          key={row.NetUid || index}
          type="button"
          onClick={() => onRowClick?.(row)}
        >
          {row.Name || row.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

const TRANSPORTER: Transporter = {
  Deleted: false,
  Id: 10,
  Name: 'Test carrier',
  NetUid: 'transporter-1',
  TransporterTypeId: 1,
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <TransportersPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Transporters canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getTransporterTypes).mockResolvedValue([
      { Id: 1, Name: 'Перевізники Україна', NetUid: 'type-1' },
    ])
    vi.mocked(getTransportersByType).mockResolvedValue([TRANSPORTER])
    vi.mocked(createTransporter).mockResolvedValue(TRANSPORTER)
    vi.mocked(updateTransporter).mockResolvedValue(TRANSPORTER)
    vi.mocked(archiveTransporter).mockResolvedValue()
  })

  it('does not mount registry requests without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getTransporterTypes).not.toHaveBeenCalled()
    expect(getTransportersByType).not.toHaveBeenCalled()
  })

  it('treats row selection as technical when no business action is available', async () => {
    allowedPermissions.add(PermissionKeys.Transporters.Page.View)
    renderPage()

    const row = await screen.findByRole('button', { name: 'Test carrier' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()
  })

  it('uses one create permission for form opener and submit', async () => {
    allowedPermissions.add(PermissionKeys.Transporters.Page.View)
    allowedPermissions.add(PermissionKeys.Transporters.Transporter.Create)
    renderPage()

    await screen.findByRole('button', { name: 'Test carrier' })
    const createButton = screen.getByRole('button', { name: 'Створити' })
    await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(createButton)
    await screen.findByText('Новий перевізник')
    fireEvent.change(await screen.findByRole('textbox', { name: /Назва/ }), { target: { value: 'Новий перевізник' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createTransporter).toHaveBeenCalledTimes(1))
    expect(updateTransporter).not.toHaveBeenCalled()
  })

  it('keeps edit independent from archive', async () => {
    allowedPermissions.add(PermissionKeys.Transporters.Page.View)
    allowedPermissions.add(PermissionKeys.Transporters.Transporter.Edit)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Test carrier' }))
    expect(screen.queryByRole('button', { name: 'Архівувати' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateTransporter).toHaveBeenCalledTimes(1))
    expect(archiveTransporter).not.toHaveBeenCalled()
  })

  it('keeps archive independent from edit', async () => {
    allowedPermissions.add(PermissionKeys.Transporters.Page.View)
    allowedPermissions.add(PermissionKeys.Transporters.Transporter.Archive)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Test carrier' }))
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Архівувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Архівувати' }))

    await waitFor(() => expect(archiveTransporter).toHaveBeenCalledWith('transporter-1'))
    expect(updateTransporter).not.toHaveBeenCalled()
  })
})
