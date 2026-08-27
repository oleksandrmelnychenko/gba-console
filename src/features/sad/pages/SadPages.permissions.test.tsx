import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { deleteSad, getOrganizations, getSad, getSads } from '../api/sadApi'
import type { Sad } from '../types'
import { AllSadsPage, EditSadPage } from './SadPages'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/sadApi', () => ({
  deleteSad: vi.fn(),
  getOrganizations: vi.fn(),
  getSad: vi.fn(),
  getSads: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../document-outcome-payment/components/DocumentOutcomePaymentModal', () => ({
  DocumentOutcomePaymentModal: ({ opened }: { opened: boolean }) => opened ? <div>OUTCOME_MODAL</div> : null,
}))

vi.mock('../components/SadPaymentFromSadModal', () => ({
  SadPaymentFromSadModal: ({ opened }: { opened: boolean }) => opened ? <div>INCOME_MODAL</div> : null,
}))

vi.mock('../components/SadSupplyOrderFromSadModal', () => ({
  SadSupplyOrderFromSadModal: ({ opened }: { opened: boolean }) => opened ? <div>SUPPLY_ORDER_MODAL</div> : null,
}))

type TestColumn = {
  cell?: (row: Sad) => ReactNode
  id: string
}

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick }: {
    columns: TestColumn[]
    data: Sad[]
    onRowClick?: (row: Sad) => void
  }) => (
    <div>
      {data.map((row) => (
        <div key={row.NetUid}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(row)}>{row.Number}</button>
          {columns.filter((column) => column.id === 'actions').map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const SENT_SAD: Sad = {
  Client: { Id: 5, NetUid: 'client-1', Name: 'Client' },
  IsSend: true,
  NetUid: 'sad-1',
  Number: 'SAD-1',
  SadItems: [],
  SadPallets: [],
  Sales: [],
}

function LocationProbe() {
  return <div>PATH:{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/sad/all']}>
          <Routes>
            <Route path="/sad/all" element={<AllSadsPage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

function renderEditor() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/sad/edit/sad-1']}>
          <Routes>
            <Route path="/sad/edit/:netid" element={<EditSadPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SAD canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSads).mockResolvedValue([SENT_SAD])
    vi.mocked(getSad).mockResolvedValue(SENT_SAD)
    vi.mocked(getOrganizations).mockResolvedValue([])
    vi.mocked(deleteSad).mockResolvedValue(undefined)
  })

  it('keeps the technical action opener and all business actions inactive without rights', async () => {
    renderPage()

    const row = await screen.findByRole('button', { name: 'SAD-1' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Переглянути' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByText('Перегляд / редагування')).toBeNull()
  })

  it('opens and navigates to details only with open-details permission', async () => {
    allowedPermissions.add(PermissionKeys.Sad.Sad.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'SAD-1' }))
    expect(screen.getByRole('button', { name: 'Перегляд / редагування' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Створити замовлення постачання' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Перегляд / редагування' }))
    expect(screen.getByText('PATH:/sad/edit/sad-1')).toBeTruthy()
  })

  it('does not load the editor aggregate when mounted without open-details', async () => {
    allowedPermissions.add(PermissionKeys.Sad.Sad.Edit)
    renderEditor()

    await waitFor(() => expect(getSad).not.toHaveBeenCalled())
    expect(getOrganizations).not.toHaveBeenCalled()
  })

  it('loads details but not edit dictionaries with open-details alone', async () => {
    allowedPermissions.add(PermissionKeys.Sad.Sad.OpenDetails)
    renderEditor()

    await waitFor(() => expect(getSad).toHaveBeenCalledWith('sad-1'))
    expect(getOrganizations).not.toHaveBeenCalled()
  })

  it('exposes supply-order creation independently and mounts its modal only after selection', async () => {
    allowedPermissions.add(PermissionKeys.Sad.SupplyOrder.Create)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'SAD-1' }))
    expect(screen.queryByRole('button', { name: 'Перегляд / редагування' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Створити замовлення постачання' }))
    expect(screen.getByText('SUPPLY_ORDER_MODAL')).toBeTruthy()
  })

  it.each([
    [PermissionKeys.Sad.Accounting.CreateIncome, 'Прибутковий касовий ордер', 'INCOME_MODAL'],
    [PermissionKeys.Sad.Accounting.CreateOutcome, 'Видатковий касовий ордер', 'OUTCOME_MODAL'],
  ])('keeps %s independent from the other accounting action', async (permission, actionName, modalName) => {
    allowedPermissions.add(permission)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'SAD-1' }))
    fireEvent.click(screen.getByRole('button', { name: actionName }))
    expect(screen.getByText(modalName)).toBeTruthy()
    expect(screen.queryByText(modalName === 'INCOME_MODAL' ? 'OUTCOME_MODAL' : 'INCOME_MODAL')).toBeNull()
  })

  it('deletes an unsent SAD only after independent delete confirmation', async () => {
    allowedPermissions.add(PermissionKeys.Sad.Sad.Delete)
    vi.mocked(getSads).mockResolvedValue([{ ...SENT_SAD, IsSend: false }])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(deleteSad).toHaveBeenCalledWith('sad-1'))
  })
})
