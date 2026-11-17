import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { CreatedResaleAvailabilityWithTotals } from '../types'
import { ResaleProcessDrawer } from './ResalesPage'

vi.mock('../api/resalesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/resalesApi')>(),
  searchResaleClients: vi.fn(async () => []),
}))

const processData = {
  ReSaleAvailabilityItemModels: [{ ProductId: 1, VendorCode: 'QA-BRK-003', ProductName: 'Диск', Qty: 3, QtyToReSale: 1, Price: 10, SalePrice: 12, Amount: 12 }],
} as unknown as CreatedResaleAvailabilityWithTotals

describe('Обробка перепродажу', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  })

  it('asks before Escape drops edited prices, and closes at once when nothing changed', async () => {
    const onClose = vi.fn()
    render(
      <MantineProvider env="test"><I18nProvider>
        <ResaleProcessDrawer canOpenProductDetails={false} isSaving={false} opened processData={processData}
          productNetIdByProductId={new Map()} onClose={onClose} onCreate={vi.fn()} onRecalculate={vi.fn(async () => ({}))} />
      </I18nProvider></MantineProvider>,
    )

    const price = await screen.findByLabelText('Ціна продажу · QA-BRK-003')
    fireEvent.change(price, { target: { value: '15' } })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText('Закрити без перерахунку?')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Закрити без змін' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
