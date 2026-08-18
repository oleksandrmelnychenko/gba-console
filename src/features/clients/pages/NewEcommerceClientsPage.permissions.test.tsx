import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { NewEcommerceClientsPage } from './NewEcommerceClientsPage'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getNewEcommerceClients: vi.fn(),
  navigate: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.can, isLoading: false }),
}))

vi.mock('../api/ecommerceClientsApi', () => ({
  getNewEcommerceClients: mocks.getNewEcommerceClients,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()

  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  }
})

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: Array<{ FullName?: string }>
    onRowClick?: (client: { FullName?: string }) => void
  }) => (
    <div>
      {data.map((client, index) => onRowClick ? (
        <button key={index} onClick={() => onRowClick(client)}>
          {client.FullName}
        </button>
      ) : (
        <span key={index}>{client.FullName}</span>
      ))}
    </div>
  ),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/new-clients-from-ecommerce']}>
      <MantineProvider>
        <NewEcommerceClientsPage />
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('NewEcommerceClientsPage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getNewEcommerceClients.mockResolvedValue([
      {
        FullName: 'Новий клієнт',
        NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ])
  })

  it('does not mount the data model without page view', () => {
    mocks.can.mockReturnValue(false)

    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(mocks.getNewEcommerceClients).not.toHaveBeenCalled()
  })

  it('renders row data but disables navigation without client details access', async () => {
    mocks.can.mockImplementation((key: string) => (
      key === PermissionKeys.NewEcommerceClients.Page.View
    ))

    renderPage()

    await waitFor(() => expect(mocks.getNewEcommerceClients).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Новий клієнт')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Новий клієнт' })).toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('navigates to the standard client details workflow with its existing permission', async () => {
    mocks.can.mockReturnValue(true)

    renderPage()

    const row = await screen.findByRole('button', { name: 'Новий клієнт' })
    fireEvent.click(row)
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/clients/edit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expect.any(Object),
    )
  })
})
