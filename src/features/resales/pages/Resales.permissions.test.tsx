import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getResaleAvailabilityFilterOptions,
} from '../api/resalesApi'
import {
  RESALES_PAGE_PERMISSION,
  RESALE_CREATE_PERMISSION,
} from '../permissions'
import type { ReSale } from '../types'
import {
  NewResalePage,
} from './ResalesPage'
import { ResaleRowActions } from './ResaleRowActions'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/resalesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/resalesApi')>(),
  getResaleAvailabilities: vi.fn().mockResolvedValue({
    GroupReSaleAvailabilities: [],
  }),
  getResaleAvailabilityFilterOptions: vi.fn().mockResolvedValue({
    ProductGroups: [],
    SpecificationCodes: [],
    Storages: [],
  }),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

function ActionProviders({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <MemoryRouter>{children}</MemoryRouter>
    </Providers>
  )
}

describe('resale permission composition', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
  })

  it('requires page view in addition to create before mounting the new-resale data flow', () => {
    allowedPermissions.add(RESALE_CREATE_PERMISSION)

    render(
      <Providers>
        <MemoryRouter initialEntries={['/resales/new']}>
          <Routes>
            <Route path="/resales/new" element={<NewResalePage />} />
          </Routes>
        </MemoryRouter>
      </Providers>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getResaleAvailabilityFilterOptions).not.toHaveBeenCalled()
  })

  it('mounts the new-resale data flow only when page view and create are both present', async () => {
    allowedPermissions.add(RESALES_PAGE_PERMISSION)
    allowedPermissions.add(RESALE_CREATE_PERMISSION)

    render(
      <Providers>
        <MemoryRouter initialEntries={['/resales/new']}>
          <Routes>
            <Route path="/resales/new" element={<NewResalePage />} />
          </Routes>
        </MemoryRouter>
      </Providers>,
    )

    expect(await screen.findByText('Новий перепродаж')).toBeTruthy()
    expect(getResaleAvailabilityFilterOptions).toHaveBeenCalledTimes(1)
  })

  it('keeps export, TTN and delete row actions independently composable', () => {
    const onDelete = vi.fn()
    const onExport = vi.fn()
    const onOpenConsignmentNote = vi.fn()
    const invoice = {
      ChangedToInvoice: true,
      NetUid: 'resale-invoice',
    } as ReSale
    const first = render(
      <ActionProviders>
        <ResaleRowActions
          exportingKey={null}
          removingNetId={null}
          resale={invoice}
          onExport={onExport}
        />
      </ActionProviders>,
    )

    expect(screen.getAllByRole('button', { name: /документ|інвойс/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'ТТН' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()

    first.unmount()
    const invoiceView = render(
      <ActionProviders>
        <ResaleRowActions
          exportingKey={null}
          removingNetId={null}
          resale={invoice}
          onDelete={onDelete}
          onOpenConsignmentNote={onOpenConsignmentNote}
        />
      </ActionProviders>,
    )
    expect(screen.getByRole('button', { name: 'ТТН' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /документ|інвойс/i })).toBeNull()
    invoiceView.unmount()

    render(
      <ActionProviders>
        <ResaleRowActions
          exportingKey={null}
          removingNetId={null}
          resale={{ NetUid: 'resale-draft' } as ReSale}
          onDelete={onDelete}
        />
      </ActionProviders>,
    )
    expect(screen.getByRole('button', { name: 'Видалити' })).toBeTruthy()
  })
})
