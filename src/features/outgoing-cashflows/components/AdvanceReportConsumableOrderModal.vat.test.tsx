import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getConsumableStoragesForAdvanceReportEdit,
  searchConsumableProductCategories,
  searchConsumableProductsByVendorCode,
  searchPaymentCostMovements,
} from '../../consumable-orders/api/consumableOrdersApi'
import { AdvanceReportConsumableOrderModal } from './AdvanceReportConsumableOrderModal'

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../consumable-orders/api/consumableOrdersApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../consumable-orders/api/consumableOrdersApi')>(),
  getConsumableStoragesForAdvanceReportEdit: vi.fn(),
  searchConsumableProductCategories: vi.fn(),
  searchConsumableProductsByVendorCode: vi.fn(),
  searchPaymentCostMovements: vi.fn(),
}))

const category = { Id: 3, Name: 'F5 Канцтовари', NetUid: 'category-3' }
const paper = { Id: 7, Name: 'F5 Папір А4', NetUid: 'product-7', VendorCode: 'F5P' }

async function openItemEditor() {
  const user = userEvent.setup()

  render(
    <MantineProvider>
      <I18nProvider>
        <AdvanceReportConsumableOrderModal
          opened
          outcomeOrder={{ Amount: 3000, NetUid: 'order-1' }}
          onAdd={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )

  await user.click(screen.getAllByRole('button', { name: 'Додати' })[0])

  return {
    article: screen.getByRole('combobox', { name: 'Артикул' }) as HTMLInputElement,
    category: screen.getByRole('textbox', { name: 'Категорія' }) as HTMLInputElement,
    name: screen.getByRole('combobox', { name: 'Назва товару / послуги' }) as HTMLInputElement,
    user,
  }
}

describe('advance report goods line: VAT-inclusive unit price (fin-06) and article list (fin-23)', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConsumableStoragesForAdvanceReportEdit).mockResolvedValue([])
    vi.mocked(searchPaymentCostMovements).mockResolvedValue([
      { Id: 4, NetUid: 'cost-4', OperationName: 'Канцтовари' },
    ])
    vi.mocked(searchConsumableProductCategories).mockResolvedValue([
      { ...category, ConsumableProducts: [paper] },
    ])
    vi.mocked(searchConsumableProductsByVendorCode).mockResolvedValue([])
  })

  it('labels the unit price as VAT-inclusive and shows the VAT breakdown', async () => {
    const fields = await openItemEditor()

    const price = screen.getByLabelText('Ціна за одиницю з ПДВ')
    expect(screen.queryByLabelText('Ціна за одиницю')).toBeNull()

    const qty = screen.getByLabelText('Кількість')
    await fields.user.clear(qty)
    await fields.user.type(qty, '3')
    await fields.user.clear(price)
    await fields.user.type(price, '120')
    const vat = screen.getByLabelText('ПДВ %')
    await fields.user.clear(vat)
    await fields.user.type(vat, '20')

    // The calculation is unchanged: 3 x 120 = 360 with VAT, of which 60 is VAT.
    const breakdown = screen.getByTestId('advance-report-item-vat-breakdown').textContent || ''
    const normalized = breakdown.replace(/\s+/g, ' ')
    expect(normalized).toMatch(/Сума без ПДВ: 300,00/)
    expect(normalized).toMatch(/ПДВ: 60,00/)
    expect(normalized).toMatch(/Разом з ПДВ: 360,00/)
  })

  it('lists the expense articles without typing', async () => {
    const fields = await openItemEditor()

    await waitFor(() => expect(searchPaymentCostMovements).toHaveBeenCalledWith('', 'advanced-report-edit'))
    await act(async () => {})
    await fields.user.click(screen.getByRole('combobox', { name: 'Стаття витрат' }))

    expect((await screen.findAllByRole('option', { hidden: true, name: 'Канцтовари' })).length).toBeGreaterThan(0)
  })
})
