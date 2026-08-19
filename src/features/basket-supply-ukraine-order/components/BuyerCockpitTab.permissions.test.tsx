import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPurchaseCockpitSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getProducerPlan, getProducerProfile } from '../api/procurementApi'
import { BuyerCockpitTab } from './BuyerCockpitTab'

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getPurchaseCockpitSuppliers: vi.fn(),
}))

vi.mock('../api/procurementApi', () => ({
  createCockpitDraftOrder: vi.fn(),
  getProducerPlan: vi.fn(),
  getProducerProfile: vi.fn(),
  recordFeedback: vi.fn(),
  upsertProducerProfile: vi.fn(),
  upsertProductTerms: vi.fn(),
}))

describe('BuyerCockpitTab permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canMock.mockReturnValue(false)
  })

  it('does not mount producer or plan requests without purchase-cockpit page access', () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <I18nProvider>
            <BuyerCockpitTab />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Недостатньо прав для перегляду панелі закупівель')).not.toBeNull()
    expect(getPurchaseCockpitSuppliers).not.toHaveBeenCalled()
    expect(getProducerPlan).not.toHaveBeenCalled()
  })

  it('keeps producer settings and draft creation hidden with page-only access', async () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.SystemPages.PurchaseCockpit.View,
    )
    vi.mocked(getPurchaseCockpitSuppliers).mockResolvedValue([{ FullName: 'Acme', Id: 42 }])
    vi.mocked(getProducerPlan).mockResolvedValue({
      as_of_date: '2026-08-19',
      effective_history_days: 30,
      effective_start: '2026-07-20',
      history_complete: true,
      history_not_applicable: [],
      item_count: 0,
      items: [],
      lead_time_days: 14,
      lead_time_std_days: 2,
      model_version: 'test',
      producer_id: 42,
      producer_name: 'Acme',
      source_history_start: '2025-01-01',
    } as never)
    vi.mocked(getProducerProfile).mockResolvedValue({
      lead_time_override_days: null,
      producer_id: 42,
      service_level_target: null,
    } as never)

    render(
      <MemoryRouter initialEntries={['/?producerId=42']}>
        <MantineProvider>
          <I18nProvider>
            <BuyerCockpitTab />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('Acme')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Налаштування виробника' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Створити замовлення постачальнику' })).toBeNull()
  })
})
