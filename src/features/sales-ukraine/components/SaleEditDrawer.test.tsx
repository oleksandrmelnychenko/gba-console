import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { clearAllSalesPendingMutations } from '../pendingSalesMutationRegistry'
import type { SalesUkraineSale } from '../types'
import { SaleEditDrawer } from './SaleEditDrawer'

const mocks = vi.hoisted(() => ({
  getShiftedSaleById: vi.fn(),
  shiftOrderItemsCurrent: vi.fn(),
  t: (key: string) => key,
  inputs: [] as string[],
}))

vi.mock('@mantine/core', async (original) => {
  const actual = await original<typeof import('@mantine/core')>()
  return { ...actual, NumberInput: (props: React.ComponentProps<typeof actual.NumberInput>) => {
    mocks.inputs.push(String(props['aria-label']))
    return <actual.NumberInput {...props} />
  } }
})

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.t }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/salesUkraineApi', () => ({
  getShiftedSaleById: mocks.getShiftedSaleById,
  shiftOrderItemsCurrent: mocks.shiftOrderItemsCurrent,
}))

const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

function createSale(existingBillShift = 0): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
    Id: 1,
    NetUid: 'sale-1',
    Order: {
      OrderItems: [{
        Id: 2,
        NetUid: 'item-1',
        Product: { NameUA: 'Товар', VendorCode: 'ABC' },
        Qty: 12,
        ShiftStatuses: existingBillShift > 0
          ? [{ Id: 3, Qty: existingBillShift, ShiftStatus: 1 }]
          : [],
      }],
    },
    SaleNumber: { Value: 'INV-1' },
  }
}

function Harness() {
  const [sale, setSale] = useState<SalesUkraineSale | null>(createSale())

  return (
    <MantineProvider env="test" theme={{ ...theme, respectReducedMotion: true }}>
      <button type="button" onClick={() => setSale(createSale(1))}>open again</button>
      <SaleEditDrawer sale={sale} onClose={() => setSale(null)} onSaved={() => setSale(null)} />
    </MantineProvider>
  )
}

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
  clearAllSalesPendingMutations()
  mocks.inputs = []
  mocks.getShiftedSaleById.mockReset()
    .mockResolvedValueOnce(createSale())
    .mockResolvedValueOnce(createSale(1))
  mocks.shiftOrderItemsCurrent.mockReset().mockResolvedValue({ NetUid: 'sale-1' })
})

afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()

  if (fontsDescriptor) {
    Object.defineProperty(document, 'fonts', fontsDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fonts')
  }
})

describe('SaleEditDrawer repeated edits', () => {
  it('keeps shift inputs editable after a successful edit and reopening the same invoice', async () => {
    render(<Harness />)

    const firstInput = await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('.sale-edit-shift-input input')
      expect(input?.disabled).toBe(false)
      return input as HTMLInputElement
    })

    fireEvent.change(firstInput, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зробити зсув' }))

    await waitFor(() => expect(mocks.shiftOrderItemsCurrent).toHaveBeenCalledOnce())
    await waitFor(() => expect(document.querySelector('.sale-edit-shift-input input')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'open again' }))
    await waitFor(() => expect(mocks.getShiftedSaleById).toHaveBeenCalledTimes(2))

    const secondInput = await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('.sale-edit-shift-input input')
      expect(input?.disabled).toBe(false)
      return input as HTMLInputElement
    })

    secondInput.focus()
    fireEvent.change(secondInput, { target: { value: '2' } })

    expect(secondInput.value).toBe('2')
    expect(document.activeElement).toBe(secondInput)
  })
  it('rerenders only the changed position inputs and preserves its draft when translation changes', async () => {
    const sale = createSale()
    sale.Order = { OrderItems: Array.from({ length: 30 }, (_, index) => ({
      Id: index + 1, NetUid: `item-${index}`, Qty: 12,
      Product: { NameUA: `Товар ${index}` },
    })) }
    mocks.getShiftedSaleById.mockReset().mockResolvedValue(sale)
    const view = () => <MantineProvider env="test" theme={theme}><SaleEditDrawer sale={sale} onClose={vi.fn()} onSaved={vi.fn()} /></MantineProvider>
    const { rerender } = render(view())
    const input = await screen.findByLabelText('В рахунок: Товар 0')
    mocks.inputs = []
    fireEvent.change(input, { target: { value: '2' } })
    expect(mocks.inputs).toEqual(['В рахунок: Товар 0', 'На склад: Товар 0'])
    const previousTranslation = mocks.t
    try {
      mocks.t = (key: string) => key
      rerender(view())
      expect(mocks.getShiftedSaleById).toHaveBeenCalledOnce()
      expect((screen.getByLabelText('В рахунок: Товар 0') as HTMLInputElement).value).toBe('2')
    } finally { mocks.t = previousTranslation }
  })

  it('aborts a closed edit read and ignores its late response after another order opens', async () => {
    let resolve!: (sale: SalesUkraineSale) => void
    mocks.getShiftedSaleById.mockReset().mockReturnValueOnce(new Promise<SalesUkraineSale>(done => { resolve = done })).mockResolvedValue(createSale(1))
    const view = (sale: SalesUkraineSale | null) => <MantineProvider env="test" theme={theme}><SaleEditDrawer sale={sale} onClose={vi.fn()} onSaved={vi.fn()} /></MantineProvider>
    const { rerender } = render(view(createSale()))
    await waitFor(() => expect(mocks.getShiftedSaleById).toHaveBeenCalledOnce())
    const signal = mocks.getShiftedSaleById.mock.calls[0][1] as AbortSignal
    rerender(view(null))
    expect(signal.aborted).toBe(true)
    rerender(view({ ...createSale(), NetUid: 'sale-2' }))
    await screen.findByLabelText('В рахунок: Товар')
    await act(async () => resolve({ ...createSale(), Order: { OrderItems: [] } }))
    expect((screen.getByLabelText('В рахунок: Товар') as HTMLInputElement).disabled).toBe(false)
  })

})
