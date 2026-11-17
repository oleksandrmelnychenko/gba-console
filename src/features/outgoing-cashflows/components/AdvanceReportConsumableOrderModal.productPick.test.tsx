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

// The option of the «Назва товару / послуги» picker (the first picker of the editor).
async function findNameOption() {
  return (await screen.findAllByRole('option', { hidden: true, name: 'F5P - F5 Папір А4' }))[0]
}

describe('advance report goods line: product picker', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConsumableStoragesForAdvanceReportEdit).mockResolvedValue([])
    vi.mocked(searchPaymentCostMovements).mockResolvedValue([])
    vi.mocked(searchConsumableProductCategories).mockResolvedValue([
      { ...category, ConsumableProducts: [paper] },
    ])
    // The vendor-code lookup of the picked product answers without it here:
    // the pick must not depend on the refreshed list.
    vi.mocked(searchConsumableProductsByVendorCode).mockResolvedValue([])
  })

  it('keeps the product picked by name: name, vendor code and category are filled', async () => {
    const fields = await openItemEditor()

    await fields.user.click(fields.name)
    await fields.user.type(fields.name, 'Папір')
    await fields.user.click(await findNameOption())
    await act(async () => {})

    await waitFor(() => expect(searchConsumableProductsByVendorCode).toHaveBeenCalledWith('F5P', 'advanced-report-edit'))
    await act(async () => {})

    expect(fields.name.value).toBe('F5P - F5 Папір А4')
    expect(fields.article.value).toBe('F5P')
    expect(fields.category.value).toBe('F5 Канцтовари')

    // The line is accepted: no «Оберіть товар або послугу» from the product check.
    await fields.user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(screen.queryByText('Оберіть товар або послугу')).toBeNull()
  })

  it('keeps the product picked with ArrowDown + Enter', async () => {
    const fields = await openItemEditor()

    await fields.user.click(fields.name)
    await fields.user.type(fields.name, 'Папір')
    await findNameOption()
    await fields.user.keyboard('{ArrowDown}{Enter}')
    await act(async () => {})

    expect(fields.name.value).toBe('F5P - F5 Папір А4')
    expect(fields.article.value).toBe('F5P')
  })

  it('keeps the product picked by vendor code', async () => {
    vi.mocked(searchConsumableProductsByVendorCode).mockResolvedValue([
      { ...paper, ConsumableProductCategory: category },
    ])
    const fields = await openItemEditor()

    await fields.user.click(fields.article)
    await fields.user.type(fields.article, 'F5')
    await fields.user.click(await screen.findByRole('option', { hidden: true, name: 'F5P' }))
    await act(async () => {})

    expect(fields.article.value).toBe('F5P')
    expect(fields.name.value).toBe('F5P - F5 Папір А4')
    expect(fields.category.value).toBe('F5 Канцтовари')
  })

  it('drops the product when the name is typed over', async () => {
    const fields = await openItemEditor()

    await fields.user.click(fields.name)
    await fields.user.type(fields.name, 'Папір')
    await fields.user.click(await findNameOption())
    await act(async () => {})

    await fields.user.clear(fields.name)
    await fields.user.type(fields.name, 'Олівець')
    await act(async () => {})

    expect(fields.article.value).toBe('')
    expect(fields.category.value).toBe('')
    await fields.user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(screen.getByText('Оберіть товар або послугу')).toBeTruthy()
  })
})
