import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { theme } from '../../shared/theme/theme'
import { AmountInput } from '../../shared/ui/AmountInput'
import { RESALE_MAX_EXTRA_CHARGE_PERCENT, RESALE_MIN_SALE_PRICE, resaleQtyLimits } from './resaleInputLimits'

function Markup() {
  const [value, setValue] = useState(0)
  return (
    <MantineProvider theme={theme}>
      <AmountInput label="Націнка, %" max={RESALE_MAX_EXTRA_CHARGE_PERCENT} value={value} onChange={setValue} />
      <output>{value}</output>
    </MantineProvider>
  )
}

describe('resale input limits', () => {
  it('limits the quantity to the available stock', () => {
    expect(resaleQtyLimits(9)).toEqual({ max: 9, min: 0 })
    expect(resaleQtyLimits(undefined)).toEqual({ min: 0 })
  })

  it('a cleared markup stays empty, so typing 7 gives 7 and not 70', () => {
    render(<Markup />)
    const input = screen.getByLabelText('Націнка, %') as HTMLInputElement

    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: '7' } })
    expect(screen.getByRole('status').textContent).toBe('7')
  })

  it('flags a negative markup and a zero sale price instead of accepting them silently', () => {
    render(
      <MantineProvider theme={theme}>
        <AmountInput label="price" min={RESALE_MIN_SALE_PRICE} value="" onChange={() => {}} />
        <AmountInput label="markup" max={RESALE_MAX_EXTRA_CHARGE_PERCENT} value="" onChange={() => {}} />
      </MantineProvider>,
    )
    fireEvent.change(screen.getByLabelText('markup'), { target: { value: '-50' } })
    fireEvent.change(screen.getByLabelText("price"), { target: { value: "0" } })

    expect(screen.getByText('Від’ємне значення не допускається')).toBeTruthy()
    expect(screen.getByText('Не менше 0,01')).toBeTruthy()
  })
})
