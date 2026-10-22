import { DateInput, type DateInputProps } from '@mantine/dates'
import { CalendarDays } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import './app-date-input.css'

type NativeDateType = 'date' | 'datetime-local'

export type AppDateInputProps = Omit<
  DateInputProps,
  'defaultValue' | 'maxDate' | 'minDate' | 'onChange' | 'type' | 'value' | 'valueFormat' | 'withTime'
> & {
  /** Mirrors the native input it replaces: `date` → `YYYY-MM-DD`, `datetime-local` → `YYYY-MM-DDTHH:mm`. */
  type?: NativeDateType
  value?: string | null
  min?: string
  max?: string
  /** Called with a native-like change event, so `event.currentTarget.value` keeps working. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const DISPLAY_FORMAT: Record<NativeDateType, string> = {
  date: 'DD.MM.YYYY',
  'datetime-local': 'DD.MM.YYYY HH:mm',
}

const PLACEHOLDER: Record<NativeDateType, string> = {
  date: 'дд.мм.рррр',
  'datetime-local': 'дд.мм.рррр гг:хх',
}

const TYPED_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/

/**
 * Calendar date field (Mantine DateInput) that is a drop-in replacement for
 * `<TextInput type="date" | "datetime-local">`: the same string values in and
 * out, `min`/`max` bounds and an `onChange(event)` handler.
 */
export function AppDateInput({
  type = 'date',
  value,
  min,
  max,
  name,
  onChange,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  placeholder,
  required,
  readOnly,
  disabled,
  rightSection,
  popoverProps,
  ...rest
}: AppDateInputProps) {
  const withTime = type === 'datetime-local'
  const [calendarOpen, setCalendarOpen] = useState(false)
  // DateInput keeps the typed text while its dropdown is open and ignores outside
  // value changes until blur. A reset from the form during that time (value
  // changed, not by us) remounts the field so it shows the new value at once,
  // like a native input. Idle fields follow the value by themselves.
  const [emitted, setEmitted] = useState(value ?? '')
  const [seen, setSeen] = useState(value ?? '')
  const [generation, setGeneration] = useState(0)
  const minDay = toPickerValue(min, false)
  const maxDay = toPickerValue(max, false)

  if ((value ?? '') !== seen) {
    setSeen(value ?? '')
    if ((value ?? '') !== emitted) {
      setEmitted(value ?? '')
      if (calendarOpen) {
        setCalendarOpen(false)
        setGeneration((current) => current + 1)
      }
    }
  }

  function emit(next: string) {
    setEmitted(next)
    setCalendarOpen(true)
    const target = { name: name ?? '', value: next }
    onChange?.({ currentTarget: target, target } as unknown as ChangeEvent<HTMLInputElement>)
  }

  return (
    <DateInput
      key={generation}
      {...rest}
      // A day grid is a `grid`, not a data table: screen readers and table queries
      // must not confuse an open calendar with the page's own tables.
      attributes={{ ...rest.attributes, month: { role: 'grid', ...rest.attributes?.month } }}
      className={['app-date-input', rest.className].filter(Boolean).join(' ')}
      // Native date inputs can always be emptied; `required` is enforced by the form.
      clearable={!readOnly && !disabled}
      data-mantine-stop-propagation={calendarOpen || undefined}
      dateParser={(input) => parseTypedDate(input, withTime)}
      disabled={disabled}
      // Like a native input, min/max only guide the calendar (out-of-range days
      // are disabled); a typed value still reaches the form, which validates it.
      getDayProps={(day) => ({
        ...rest.getDayProps?.(day),
        disabled: Boolean((minDay && day < minDay) || (maxDay && day > maxDay)) || rest.getDayProps?.(day).disabled,
      })}
      max={max}
      min={min}
      name={name}
      placeholder={placeholder ?? PLACEHOLDER[type]}
      popoverProps={{ withinPortal: true, ...popoverProps }}
      readOnly={readOnly}
      required={required}
      rightSection={rightSection ?? <CalendarDays aria-hidden="true" size={15} />}
      rightSectionPointerEvents={rightSection ? undefined : 'none'}
      value={toPickerValue(value, withTime)}
      valueFormat={DISPLAY_FORMAT[type]}
      withTime={withTime}
      onBlur={(event) => {
        setCalendarOpen(false)
        onBlur?.(event)
      }}
      onChange={(next) => emit(toNativeValue(next, withTime))}
      onClick={(event) => {
        setCalendarOpen(true)
        onClick?.(event)
      }}
      onFocus={(event) => {
        setCalendarOpen(true)
        onFocus?.(event)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        // The first Escape closes the calendar; a second one may close the host drawer.
        if (event.key === 'Escape') setCalendarOpen(false)
      }}
    />
  )
}

/** Native value (`YYYY-MM-DD` / `YYYY-MM-DDTHH:mm`, tolerant of longer ISO strings) → DateInput value. */
function toPickerValue(value: string | null | undefined, withTime: boolean): string | null {
  const match = value ? ISO_DATE.exec(value) : null

  if (!match) {
    return null
  }

  const [, year, month, day, hours = '00', minutes = '00'] = match
  return withTime ? `${year}-${month}-${day} ${hours}:${minutes}:00` : `${year}-${month}-${day}`
}

/** DateInput value (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`) → native value. */
function toNativeValue(value: string | null, withTime: boolean): string {
  const match = value ? ISO_DATE.exec(value) : null

  if (!match) {
    return ''
  }

  const [, year, month, day, hours = '00', minutes = '00'] = match
  return withTime ? `${year}-${month}-${day}T${hours}:${minutes}` : `${year}-${month}-${day}`
}

/** Accepts what people type (`01.10.2026`, `1.10.2026 9:30`) and ISO values; anything partial stays unparsed. */
function parseTypedDate(input: string, withTime: boolean): string | null {
  const text = input.trim()
  const typed = TYPED_DATE.exec(text)
  let parts: [number, number, number, number, number] | null = null

  if (typed) {
    parts = [Number(typed[3]), Number(typed[2]), Number(typed[1]), Number(typed[4] ?? 0), Number(typed[5] ?? 0)]
  } else {
    const iso = ISO_DATE.exec(text)
    if (iso && iso[0].length === text.length) {
      parts = [Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0)]
    }
  }

  if (!parts) {
    return null
  }

  const [year, month, day, hours, minutes] = parts
  const date = new Date(year, month - 1, day, hours, minutes)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || hours > 23 || minutes > 59) {
    return null
  }

  const pad = (part: number) => String(part).padStart(2, '0')
  const datePart = `${year}-${pad(month)}-${pad(day)}`
  return withTime ? `${datePart} ${pad(hours)}:${pad(minutes)}:00` : datePart
}
