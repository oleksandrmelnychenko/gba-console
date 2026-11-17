import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AmountInput } from './AmountInput'
import { MAX_CASH_ORDER_AMOUNT, parseAmountText } from './amountText'

function AmountForm({ initial = 0 }: { initial?: number }) {
  const [amount, setAmount] = useState(initial)

  return (
    <form data-testid="form">
      <AmountInput label="Сума" max={MAX_CASH_ORDER_AMOUNT} required value={amount} onChange={setAmount} />
      <AmountInput label="Ставка ПДВ" max={100} maxMessage="Ставка ПДВ — від 0 до 100%" value={0} onChange={() => {}} />
      <output data-testid="amount">{amount}</output>
    </form>
  )
}

function renderForm(initial?: number) {
  render(
    <MantineProvider>
      <AmountForm initial={initial} />
    </MantineProvider>,
  )

  return screen.getByRole('textbox', { name: /^Сума/ }) as HTMLInputElement
}

describe('AmountInput', () => {
  it('select-all + Backspace leaves the field empty, so typing 100 is 100 (not 1000)', async () => {
    const user = userEvent.setup()
    const input = renderForm()

    await user.type(input, '555')
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    expect(input.value).toBe('')
    expect(screen.getByTestId('amount').textContent).toBe('0')

    await user.type(input, '100')
    expect(input.value).toBe('100')
    expect(screen.getByTestId('amount').textContent).toBe('100')
  })

  it('reads «1234,56» set in one input event (paste / autofill) as 1234.56', () => {
    const input = renderForm()

    fireEvent.change(input, { target: { value: '1234,56' } })

    expect(screen.getByTestId('amount').textContent).toBe('1234.56')
    expect(input.value).toBe('1234,56')
  })

  it('reads a pasted «1 234,56» with spaces', async () => {
    const user = userEvent.setup()
    const input = renderForm()

    await user.click(input)
    await user.paste('1 234,56')

    expect(screen.getByTestId('amount').textContent).toBe('1234.56')
  })

  it('shows a minus instead of dropping it, and blocks the form', async () => {
    const user = userEvent.setup()
    const input = renderForm()

    await user.type(input, '-500')

    expect(input.value).toBe('-500')
    expect(screen.getByText('Від’ємне значення не допускається')).toBeTruthy()
    expect(input.validationMessage || input.validity.customError).toBeTruthy()
    expect(screen.getByTestId('amount').textContent).toBe('0')
  })

  it('rejects an amount above the cash-order limit and a VAT rate above 100%', async () => {
    const user = userEvent.setup()
    const input = renderForm()
    const vat = screen.getByRole('textbox', { name: /Ставка ПДВ/ }) as HTMLInputElement

    await user.type(input, '99999999999999')
    await user.type(vat, '150')

    expect(input.validity.customError).toBe(true)
    expect(vat.validity.customError).toBe(true)
    expect(screen.getByText('Ставка ПДВ — від 0 до 100%')).toBeTruthy()
    expect((screen.getByTestId('form') as HTMLFormElement).checkValidity()).toBe(false)
  })

  it('shows an amount the form sets itself', () => {
    const input = renderForm(1500.5)

    expect(input.value).toBe('1500,5')
  })

  it('rounds a computed amount to the field precision instead of rejecting it', () => {
    const input = renderForm(0.1 + 0.2)

    expect(input.value).toBe('0,3')
    expect(input.validity.customError).toBe(false)
  })
})

describe('AmountInput as a quantity', () => {
  it('cleared quantity 1 then typed 3 is 3 (not 30)', async () => {
    const user = userEvent.setup()

    function Quantity() {
      const [qty, setQty] = useState(1)

      return (
        <>
          <AmountInput decimalScale={3} label="Кількість" value={qty} onChange={setQty} />
          <output data-testid="qty">{qty}</output>
        </>
      )
    }

    render(<MantineProvider><Quantity /></MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Кількість' }) as HTMLInputElement

    await user.click(input)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    await user.type(input, '3')

    expect(input.value).toBe('3')
    expect(screen.getByTestId('qty').textContent).toBe('3')
  })
})

describe('parseAmountText', () => {
  it.each([
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['1 234,5', 1234.5],
    [',5', 0.5],
    ['', null],
  ])('%s -> %s', (text, expected) => {
    expect(parseAmountText(text).value).toBe(expected)
  })

  it('marks letters and a second separator as invalid', () => {
    expect(parseAmountText('12a').isInvalid).toBe(true)
    expect(parseAmountText('1.234,56').isInvalid).toBe(true)
  })
})
