import { TextInput, type TextInputProps } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { parseColumnNumberText } from '../importColumnsValidation'

type ColumnNumberInputProps = Omit<TextInputProps, 'value' | 'onChange' | 'error'> & {
  value: number | ''
  onChange: (value: number | '') => void
}

/**
 * Column / row number of an Excel import. The text stays as typed; a value that is not a
 * whole number from 1 shows an inline error and reaches the form as empty, so the import
 * is refused by name instead of being sent with a silently rewritten number.
 */
export function ColumnNumberInput({ value, onChange, disabled, ...props }: ColumnNumberInputProps) {
  const { t } = useI18n()
  const [text, setText] = useState(value === '' ? '' : String(value))
  const [syncedValue, setSyncedValue] = useState(value)
  const parsed = parseColumnNumberText(text, t)

  // The form can clear or set the number itself (an option switched off): follow it,
  // but keep the typed text while it still stands for the same value.
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (parsed.value !== value) {
      setText(value === '' ? '' : String(value))
    }
  }

  return (
    <TextInput
      {...props}
      disabled={disabled}
      error={disabled ? undefined : parsed.error}
      inputMode="numeric"
      value={text}
      onChange={(event) => {
        const nextText = event.currentTarget.value
        const next = parseColumnNumberText(nextText, t)

        setText(nextText)
        setSyncedValue(next.value)
        if (next.value !== value) {
          onChange(next.value)
        }
      }}
    />
  )
}
