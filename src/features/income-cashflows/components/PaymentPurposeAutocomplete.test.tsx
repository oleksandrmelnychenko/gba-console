import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchIncomeCashflowPaymentPurposes } from '../api/incomeCashflowsApi'
import { PaymentPurposeAutocomplete } from './PaymentPurposeAutocomplete'

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  searchIncomeCashflowPaymentPurposes: vi.fn(),
}))

const searchPaymentPurposesMock = vi.mocked(searchIncomeCashflowPaymentPurposes)

function ControlledAutocomplete({ clientNetId = 'client-1' }: { clientNetId?: string }) {
  const [value, setValue] = useState('')

  return (
    <MantineProvider>
      <PaymentPurposeAutocomplete
        clientAgreementNetId="client-agreement-1"
        clientNetId={clientNetId}
        label="Призначення платежу"
        value={value}
        onChange={setValue}
      />
    </MantineProvider>
  )
}

describe('PaymentPurposeAutocomplete', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    searchPaymentPurposesMock.mockResolvedValue(['Оплата за товар', 'Оплата згідно рахунку'])
  })

  it('loads historical suggestions for the selected client agreement', async () => {
    render(<ControlledAutocomplete />)

    await waitFor(() => {
      expect(searchPaymentPurposesMock).toHaveBeenCalledWith({
        clientAgreementNetId: 'client-agreement-1',
        clientNetId: 'client-1',
        limit: 10,
        signal: expect.any(AbortSignal),
        value: '',
      })
    })

    await waitFor(() => expect(screen.getByText('Оплата за товар')).toBeTruthy())
  })

  it('keeps free text and searches again after the debounce', async () => {
    render(<ControlledAutocomplete />)

    await waitFor(() => expect(searchPaymentPurposesMock).toHaveBeenCalledTimes(1))
    searchPaymentPurposesMock.mockClear()

    const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Призначення платежу' })
    fireEvent.change(input, { target: { value: 'Нове призначення' } })

    expect(input.value).toBe('Нове призначення')
    expect(searchPaymentPurposesMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Оплата за товар')).toBeNull()

    await waitFor(() => {
      expect(searchPaymentPurposesMock).toHaveBeenCalledWith({
        clientAgreementNetId: 'client-agreement-1',
        clientNetId: 'client-1',
        limit: 10,
        signal: expect.any(AbortSignal),
        value: 'Нове призначення',
      })
    })
  })

  it('does not request suggestions before the client agreement scope is complete', () => {
    render(
      <MantineProvider>
        <PaymentPurposeAutocomplete clientNetId="client-1" label="Призначення платежу" value="Власний текст" onChange={vi.fn()} />
      </MantineProvider>,
    )

    expect(searchPaymentPurposesMock).not.toHaveBeenCalled()
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Призначення платежу' }).value).toBe('Власний текст')
  })

  it('cancels the previous scoped request when the client changes', async () => {
    const props = {
      label: 'Призначення платежу',
      onChange: vi.fn(),
      value: '',
    }
    const { rerender } = render(
      <MantineProvider>
        <PaymentPurposeAutocomplete {...props} clientAgreementNetId="agreement-1" clientNetId="client-1" />
      </MantineProvider>,
    )

    await waitFor(() => expect(searchPaymentPurposesMock).toHaveBeenCalledTimes(1))
    const firstSignal = searchPaymentPurposesMock.mock.calls[0][0].signal

    rerender(
      <MantineProvider>
        <PaymentPurposeAutocomplete {...props} clientAgreementNetId="agreement-2" clientNetId="client-2" />
      </MantineProvider>,
    )

    await waitFor(() => expect(searchPaymentPurposesMock).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)
    expect(searchPaymentPurposesMock.mock.calls[1][0]).toMatchObject({ clientNetId: 'client-2' })
  })
})
