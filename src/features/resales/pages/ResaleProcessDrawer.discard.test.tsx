import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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

describe('Обробка перепродажу after the automatic recalculation', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  })

  it('still asks before Escape drops edited prices once the recalculation has succeeded', async () => {
    const onClose = vi.fn()
    const recalculated = {
      ReSaleAvailabilityItemModels: [{ ...processData.ReSaleAvailabilityItemModels[0], SalePrice: 700, Amount: 700 }],
    } as unknown as CreatedResaleAvailabilityWithTotals
    const onRecalculate = vi.fn(async () => ({ data: recalculated }))
    const closePage = vi.fn()
    // as on /resales/new: the «Обробка» sheet over the «Новий перепродаж» page sheet
    render(
      <MantineProvider env="test"><I18nProvider>
        <AppDrawer closeOnEscape={false} opened title="Новий перепродаж" onClose={closePage}>
          <ResaleProcessDrawer canOpenProductDetails={false} isSaving={false} opened processData={processData}
            productNetIdByProductId={new Map()} onClose={onClose} onCreate={vi.fn()} onRecalculate={onRecalculate} />
        </AppDrawer>
      </I18nProvider></MantineProvider>,
    )

    const price = await screen.findByLabelText('Ціна продажу · QA-BRK-003')
    fireEvent.pointerDown(price)
    fireEvent.focusIn(price)
    fireEvent.change(price, { target: { value: '700' } })
    await waitFor(() => expect(onRecalculate).toHaveBeenCalledOnce(), { timeout: 2000 })
    await waitFor(() => expect(screen.queryByText('Перерахуйте позиції перед створенням')).toBeNull())

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(await screen.findByText('Закрити без збереження?')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Повернутися' }))
    await waitFor(() => expect(screen.queryByText('Закрити без збереження?')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(closePage).not.toHaveBeenCalled()
  })
})
