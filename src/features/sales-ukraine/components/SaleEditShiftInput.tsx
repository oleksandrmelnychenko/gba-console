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
        allowDecimal={false}
        allowNegative={false}
        clampBehavior="strict"
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
