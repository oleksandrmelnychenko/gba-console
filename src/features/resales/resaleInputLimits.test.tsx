import { MantineProvider, NumberInput } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../shared/theme/theme'
import { RESALE_MARKUP_INPUT_PROPS, RESALE_PRICE_INPUT_PROPS, resaleQtyInputProps } from './resaleInputLimits'

function renderInput(props: object, label: string) {
  const onChange = vi.fn()
  render(<MantineProvider theme={theme}><NumberInput label={label} {...props} onChange={onChange} /></MantineProvider>)
  return { input: screen.getByLabelText(label) as HTMLInputElement, onChange }
}

describe('resale input limits', () => {
  it('limits the quantity to the available stock and never below zero', () => {
    expect(resaleQtyInputProps(9)).toMatchObject({ allowNegative: false, max: 9, min: 0 })
    expect(resaleQtyInputProps(undefined)).not.toHaveProperty('max')

    const { input, onChange } = renderInput(resaleQtyInputProps(9), 'Кількість')
    fireEvent.change(input, { target: { value: '999' } })
    expect(onChange).not.toHaveBeenCalledWith(999)
  })

  it('rejects a negative markup and a negative sale price', () => {
    expect(RESALE_MARKUP_INPUT_PROPS).toMatchObject({ allowNegative: false, min: 0, max: 1000 })
    expect(RESALE_PRICE_INPUT_PROPS.allowNegative).toBe(false)

    const { input, onChange } = renderInput(RESALE_MARKUP_INPUT_PROPS, 'Націнка, %')
    fireEvent.change(input, { target: { value: '-50' } })
    expect(onChange).not.toHaveBeenCalledWith(-50)
  })
})
