import { NumberInput, Tooltip } from '@mantine/core'
import { memo } from 'react'

type Props = {
  itemKey: string
  target: 'bill' | 'store'
  value: number | string
  max: number
  disabled: boolean
  label: string
  hint: string
  showHint: boolean
  onChange: (key: string, target: 'bill' | 'store', value: number | string) => void
}

// Primitive props keep the other positions' NumberInputs out of a draft edit.
export const SaleEditShiftInput = memo(function SaleEditShiftInput({
  itemKey, target, value, max, disabled, label, hint, showHint, onChange,
}: Props) {
  return (
    <Tooltip label={hint} disabled={!showHint} withArrow>
      <NumberInput
        // Weighed goods (kg, l) are shifted in fractions; the server accepts any positive quantity.
        allowDecimal
        decimalScale={3}
        allowNegative={false}
        // Too large values are clamped to the remaining quantity on blur instead of being silently dropped.
        clampBehavior="blur"
        hideControls
        max={max}
        min={0}
        className="sale-edit-shift-input"
        aria-label={label}
        placeholder="0"
        disabled={disabled}
        size="xs"
        value={value}
        onChange={(next) => onChange(itemKey, target, next)}
      />
    </Tooltip>
  )
})
