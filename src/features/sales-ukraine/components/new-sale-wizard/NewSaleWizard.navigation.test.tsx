import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getCurrentSaleCart, getSaleById } from '../../api/salesUkraineApi'
import type { SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'
import { NewSaleWizard } from './NewSaleWizard'

const wizardMocks = vi.hoisted(() => ({
  notify: vi.fn(),
  productSales: [] as unknown[],
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: wizardMocks.notify } }))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { user: { NetUid: 'user-1' } },
  }),
}))

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...original,
    getCurrentSaleCart: vi.fn(),
    getSaleById: vi.fn(),
  }
})

vi.mock('./NewSaleClientStep', () => ({
  NewSaleClientStep: ({
    onAgreementChange,
  }: {
    onAgreementChange: (agreementNetId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  }) => (
    <div data-testid="client-step">
      <button type="button" onClick={() => onAgreementChange('agreement-2', { NetUid: 'agreement-2' })}>
        pick second agreement
      </button>
    </div>
  ),
}))

vi.mock('./NewSaleProductsStep', () => ({
  NewSaleProductsStep: ({
    onBusyChange,
    permissionFlow,
    sale,
  }: {
    onBusyChange?: (busy: boolean) => void
    permissionFlow?: string
    sale: SalesUkraineSale | null
  }) => {
    wizardMocks.productSales.push(sale)

    return (
      <div data-testid="products-step">
        <span data-testid="products-sale">{sale?.NetUid}</span>
        <span data-testid="products-flow">{permissionFlow}</span>
        <button type="button" onClick={() => onBusyChange?.(true)}>start cart request</button>
        <button type="button" onClick={() => onBusyChange?.(false)}>finish cart request</button>
      </div>
    )
  },
}))

vi.mock('./NewSaleReviewStep', () => ({
  NewSaleReviewStep: () => <div data-testid="review-step" />,
}))

vi.mock('./WizardSaleHeader', () => ({
  WizardSaleHeader: () => null,
}))

vi.mock('./WizardDownloadDocumentsModal', () => ({
  WizardDownloadDocumentsModal: () => null,
}))

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const agreement: SalesUkraineClientAgreement = { Client: { Id: 7, NetUid: 'client-1' }, NetUid: 'agreement-1' }
const currentBill: SalesUkraineSale = {
  ClientAgreement: agreement,
  NetUid: 'sale-1',
  Order: { OrderItems: [{ Id: 1, NetUid: 'item-1', Product: { Id: 1, NetUid: 'product-1' }, Qty: 1 }] },
}

function renderWizard(editSale?: SalesUkraineSale) {
  return render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <NewSaleWizard
          opened
          editSale={editSale}
          prefill={editSale ? null : {
            agreement,
            agreementNetId: 'agreement-1',
            client: { Id: 7, NetUid: 'client-1' },
            clientNetId: 'client-1',
          }}
          onClose={() => {}}
          onCreated={() => {}}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

async function clickNext() {
  const next = await screen.findByRole('button', { name: 'Далі' })
  await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(next)
}

async function clickBack() {
  fireEvent.click(await screen.findByRole('button', { name: 'Назад' }))
  await screen.findByTestId('client-step')
}

function notifiedMessages(): string[] {
  return wizardMocks.notify.mock.calls.map(([options]) => String(options.message))
}

describe('new sale wizard step navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    wizardMocks.productSales.length = 0
  })

  afterEach(() => {
    cleanup()
  })

  it('reopens the same bill after going back to clients and forward again', async () => {
    vi.mocked(getCurrentSaleCart).mockResolvedValue(currentBill)
    renderWizard()

    await clickNext()
    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-1')

    await clickBack()
    await clickNext()

    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-1')
    expect(getCurrentSaleCart).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getCurrentSaleCart).mock.calls.every(([netId]) => netId === 'agreement-1')).toBe(true)
    expect(wizardMocks.notify).not.toHaveBeenCalled()
  })

  it('keeps the draft placeholder stable while the host re-renders during a cart request', async () => {
    vi.mocked(getCurrentSaleCart).mockResolvedValue(null)
    renderWizard()

    await clickNext()
    expect((await screen.findByTestId('products-sale')).textContent).toBe(EMPTY_GUID)
    const placeholder = wizardMocks.productSales.at(-1)

    fireEvent.click(screen.getByRole('button', { name: 'start cart request' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Назад' }) as HTMLButtonElement).disabled).toBe(true))

    expect(wizardMocks.productSales.at(-1)).toBe(placeholder)

    fireEvent.keyDown(document, { altKey: true, code: 'Digit3' })
    fireEvent.keyDown(document, { altKey: true, code: 'Digit1' })

    expect(wizardMocks.notify).not.toHaveBeenCalled()
    expect(screen.queryByTestId('products-step')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'finish cart request' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Назад' }) as HTMLButtonElement).disabled).toBe(false))
    expect(wizardMocks.productSales.at(-1)).toBe(placeholder)
  })

  it('explains how the bill is created instead of the legacy error when the cart is empty', async () => {
    vi.mocked(getCurrentSaleCart).mockResolvedValue(null)
    renderWizard()

    await clickNext()
    await screen.findByTestId('products-step')

    fireEvent.keyDown(document, { altKey: true, code: 'Digit3' })
    fireEvent.click(screen.getByRole('button', { name: 'Перевізники' }))

    expect(notifiedMessages()).toEqual([
      'Додайте товар у кошик: рахунок створюється з першою позицією',
      'Додайте товар у кошик: рахунок створюється з першою позицією',
    ])
    expect(wizardMocks.notify.mock.calls.every(([options]) => options.color === 'orange')).toBe(true)
    expect(screen.queryByTestId('products-step')).not.toBeNull()
  })

  it('says that the bill was switched when another agreement is chosen on the way back', async () => {
    const otherBill: SalesUkraineSale = { NetUid: 'sale-2', Order: { OrderItems: [] } }
    vi.mocked(getCurrentSaleCart).mockImplementation(async (agreementNetId) => (
      agreementNetId === 'agreement-1' ? currentBill : otherBill
    ))
    renderWizard()

    await clickNext()
    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-1')
    await clickBack()
    fireEvent.click(screen.getByRole('button', { name: 'pick second agreement' }))
    await clickNext()

    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-2')
    expect(vi.mocked(getCurrentSaleCart).mock.calls.at(-1)?.[0]).toBe('agreement-2')
    expect(notifiedMessages()).toEqual([
      'Клієнта або договір змінено: відкрито поточний рахунок за вибраним договором',
    ])
  })

  it('announces that a new bill will be created when the chosen agreement has none', async () => {
    vi.mocked(getCurrentSaleCart).mockImplementation(async (agreementNetId) => (
      agreementNetId === 'agreement-1' ? currentBill : null
    ))
    renderWizard()

    await clickNext()
    await screen.findByTestId('products-step')
    await clickBack()
    fireEvent.click(screen.getByRole('button', { name: 'pick second agreement' }))
    await clickNext()

    expect((await screen.findByTestId('products-sale')).textContent).toBe(EMPTY_GUID)
    expect(notifiedMessages()).toEqual([
      'Клієнта або договір змінено: рахунок за вибраним договором буде створено з першим товаром',
    ])
  })

  it('returns to the edited bill instead of the create cart after going back and forward', async () => {
    const edited: SalesUkraineSale = { ...currentBill, HasDetails: true, NetUid: 'sale-edit' }
    vi.mocked(getSaleById).mockResolvedValue(edited)
    vi.mocked(getCurrentSaleCart).mockResolvedValue(currentBill)
    renderWizard(edited)

    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-edit')
    expect(screen.getByTestId('products-flow').textContent).toBe('edit')

    await clickBack()
    await clickNext()

    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-edit')
    expect(screen.getByTestId('products-flow').textContent).toBe('edit')
    expect(getSaleById).toHaveBeenCalledTimes(2)
    expect(getCurrentSaleCart).not.toHaveBeenCalled()
    expect(wizardMocks.notify).not.toHaveBeenCalled()
  })

  it('stays on the client step with a retry hint when the bill cannot be loaded', async () => {
    vi.mocked(getCurrentSaleCart)
      .mockRejectedValueOnce(new Error('Gateway Timeout'))
      .mockResolvedValueOnce(currentBill)
    renderWizard()

    await clickNext()
    await waitFor(() => expect(wizardMocks.notify).toHaveBeenCalledOnce())

    expect(wizardMocks.notify.mock.calls[0][0]).toMatchObject({
      color: 'red',
      message: 'Gateway Timeout. Натисніть «Далі», щоб повторити',
      title: 'Рахунок не завантажено',
    })
    expect(screen.queryByTestId('client-step')).not.toBeNull()
    expect(screen.queryByTestId('products-step')).toBeNull()

    await act(async () => {
      await clickNext()
    })

    expect((await screen.findByTestId('products-sale')).textContent).toBe('sale-1')
  })
})
