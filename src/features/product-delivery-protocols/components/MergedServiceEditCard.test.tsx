import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedService } from '../detailTypes'
import { MergedServiceEditCard } from './MergedServiceEditCard'

const mocks = vi.hoisted(() => ({
  getResponsibleUsers: vi.fn(),
  getSupplyServiceConsumableProducts: vi.fn(),
  searchSupplyOrganizations: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => opened ? (
    <div>
      {children}
      {footer}
    </div>
  ) : null,
}))

vi.mock('../api/protocolDetailApi', () => ({
  getResponsibleUsers: mocks.getResponsibleUsers,
  getSupplyServiceConsumableProducts: mocks.getSupplyServiceConsumableProducts,
  searchSupplyOrganizations: mocks.searchSupplyOrganizations,
}))

const requiredLabel = (label: string) => new RegExp(`^${label}(?: \\*)?$`)
const getInput = (label: string) => screen.getAllByLabelText(requiredLabel(label)).find(
  (element) => element.tagName === 'INPUT',
) as HTMLInputElement

const service: MergedService = {
  ConsumableProduct: { Name: 'Послуга', NetUid: 'product-1' },
  GrossPrice: 100,
  Number: 'INV-1',
  SupplyOrganization: {
    Name: 'Постачальник',
    NetUid: 'supplier-1',
    SupplyOrganizationAgreements: [
      { Currency: { Code: 'UAH' }, Name: 'Договір', NetUid: 'agreement-1' },
    ],
  },
  SupplyOrganizationAgreement: { Currency: { Code: 'UAH' }, Name: 'Договір', NetUid: 'agreement-1' },
  SupplyPaymentTask: { GrossPrice: 100, User: null },
}

describe('MergedServiceEditCard validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getResponsibleUsers.mockReturnValue(new Promise(() => {}))
    mocks.getSupplyServiceConsumableProducts.mockReturnValue(new Promise(() => {}))
    mocks.searchSupplyOrganizations.mockResolvedValue([])
  })

  it('shows the agreement currency and automatic fallback on both rate overrides', () => {
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={service}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </MantineProvider>,
    )

    const managementRate = screen.getByLabelText('Курс управлінських витрат (UAH = 1)') as HTMLInputElement
    const accountingRate = screen.getByLabelText('Курс бухгалтерських витрат (UAH = 1)') as HTMLInputElement

    expect(managementRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(accountingRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(screen.getAllByText(/Договір у гривні: автоматичний курс дорівнює 1/)).toHaveLength(2)
  })

  it('blocks save and identifies a conditionally required task user', () => {
    const onSave = vi.fn()
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={service}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Заповніть хоча б одну вартість: управлінську або бухгалтерську')).toBeTruthy()
    const responsible = getInput('Відповідальний')
    expect(responsible.getAttribute('aria-required')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(responsible.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByText('Вкажіть відповідального за платіжну задачу')).toHaveLength(2)

    fireEvent.change(getInput('Назва'), { target: { value: 'Оновлена назва' } })

    expect(responsible.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Вкажіть відповідального за платіжну задачу')).toBeTruthy()
  })

  it('allows saving without a type', () => {
    const onSave = vi.fn()
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={{ ...service, ConsumableProduct: null, SupplyPaymentTask: null }}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </MantineProvider>,
    )

    const type = getInput('Тип')
    expect(type.getAttribute('aria-required')).not.toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].ConsumableProduct).toBeNull()
    expect(screen.queryByText('Оберіть тип')).toBeNull()
  })
})
