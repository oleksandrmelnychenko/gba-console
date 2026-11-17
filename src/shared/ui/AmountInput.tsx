import { TextInput, type TextInputProps } from '@mantine/core'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  formatAmountText,
  getAmountError,
  parseAmountText,
  toAmount,
  toEmittedAmount,
} from './amountText'

export interface AmountInputProps extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'type' | 'error'> {
  value: number | string | null | undefined
  onChange: (value: number) => void
  /** Digits allowed after the decimal separator. */
  decimalScale?: number
  /** Inclusive upper bound; a larger value is reported as an error and blocks the form. */
  max?: number
  /** Inclusive lower bound (0 by default). Negative input is never accepted. */
  min?: number
  /** Overrides the built-in bound message. */
  maxMessage?: string
  error?: string | null
}

/**
 * Money / percent field for the cash-order forms.
 *
 * Unlike a NumberInput it keeps what the user typed: clearing the field leaves
 * it empty (not «0» with the caret in front), «1234,56» typed, pasted or
 * autofilled is 1234.56, and a minus sign or a value above `max` is shown as
 * an error that also blocks the browser's form submit.
 */
export function AmountInput({
  decimalScale = 2,
  error,
  max,
  maxMessage,
  min = 0,
  value,
  onBlur,
  onChange,
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => formatAmountText(value, decimalScale))
  const [seenValue, setSeenValue] = useState(value)

  // The form changed the amount itself (reset, auto-allocation): show it,
  // unless it is what the current text already means.
  if (!Object.is(seenValue, value)) {
    setSeenValue(value)

    if ((toAmount(value) ?? 0) !== toEmittedAmount(parseAmountText(text))) {
      setText(formatAmountText(value, decimalScale))
    }
  }

  const parsed = parseAmountText(text)
  const validationError = getAmountError(parsed, { decimalScale, max, maxMessage, min })
  const shownError = validationError || error || null

  useEffect(() => {
    inputRef.current?.setCustomValidity(validationError || '')
  }, [validationError])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextText = event.currentTarget.value
    const next = parseAmountText(nextText)

    setText(nextText)
    onChange(toEmittedAmount(next))
  }

  return (
    <TextInput
      {...props}
      autoComplete="off"
      error={shownError}
      inputMode="decimal"
      ref={inputRef}
      value={text}
      onBlur={(event) => {
        const next = parseAmountText(text)

        if (next.value !== null && !getAmountError(next, { decimalScale, max, maxMessage, min })) {
          setText(formatAmountText(next.value, decimalScale))
        }

        onBlur?.(event)
      }}
      onChange={handleChange}
    />
  )
}
