import { ActionIcon, Button, Group, Popover, TextInput, Tooltip } from '@mantine/core'
import { DatePicker, type DatePickerPreset } from '@mantine/dates'
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import './toolbar-date-range-filter.css'

type Props = {
  from: string
  to: string
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  fromLabel?: string
  toLabel?: string
  onChange: (range: { from: string; to: string }) => void
}

function displayDate(value: string) {
  return value ? value.split('-').reverse().join('.') : '…'
}

function validDate(date: string, min?: string, max?: string) {
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === date &&
    (!min || date >= min) && (!max || date <= max)
}

function validateRange(range: { from: string; to: string }, required: boolean, min?: string, max?: string) {
  if (required && (!range.from || !range.to)) return 'Вкажіть дату початку та дату завершення'
  if (required && (!validDate(range.from, min, max) || !validDate(range.to, min, max))) {
    return 'Вкажіть коректні дати в межах дозволеного періоду'
  }
  if (range.from && range.to && range.from > range.to) return 'Дата «Від» має бути не пізніше дати «До»'
  return null
}

function isoDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function buildPresets(t: (key: string) => string): DatePickerPreset<'range'>[] {
  const today = new Date()
  const shifted = (days: number) => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days))
  const end = isoDate(today)

  return [
    { label: t('Сьогодні'), value: [end, end] },
    { label: t('Вчора'), value: [shifted(1), shifted(1)] },
    { label: t('7 днів'), value: [shifted(6), end] },
    { label: t('30 днів'), value: [shifted(29), end] },
    { label: t('Цей місяць'), value: [isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), end] },
    {
      label: t('Минулий місяць'),
      value: [
        isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      ],
    },
  ]
}

export function ToolbarDateRangeFilter({ from, to, min, max, disabled, required = false, fromLabel, toLabel, onChange }: Props) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState({ from, to })
  const presets = useMemo(() => buildPresets(t), [t])
  const error = validateRange(draft, required, min, max)
  const rangeError = error ? t(error) : null
  const invalidRange = Boolean(rangeError)
  const summary = from || to ? `${displayDate(from)} — ${displayDate(to)}` : t('Увесь період')
  const fromMax = [draft.to, max].filter(Boolean).sort()[0]
  const toMin = [draft.from, min].filter(Boolean).sort().at(-1)

  function changeOpened(next: boolean) {
    if (next) setDraft({ from, to })
    setOpened(next)
  }

  return (
    <div className="app-date-range-icon-wrap">
      <Popover opened={opened} onChange={changeOpened} position="bottom-start" withinPortal trapFocus returnFocus shadow="md">
        <Popover.Target>
          <Tooltip label={`${t('Період')}: ${summary}`} disabled={opened}>
            <ActionIcon
              variant="default"
              disabled={disabled}
              aria-label={`${t('Період')}: ${summary}`}
              aria-haspopup="dialog"
              aria-expanded={opened}
              onClick={() => changeOpened(!opened)}
            >
              <CalendarDays size={18} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        {/* Mantine Drawer checks this marker on the key target during window capture. */}
        <Popover.Dropdown className="app-date-range-menu" role="dialog" aria-label={t('Період')} data-mantine-stop-propagation>
          <form
            className="app-date-range-panel"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (invalidRange || disabled) return
              onChange(draft)
              setOpened(false)
            }}
          >
            <DatePicker
              allowSingleDateInRange
              className="app-date-range-calendar"
              data-mantine-stop-propagation
              defaultDate={draft.to || draft.from || undefined}
              maxDate={max}
              minDate={min}
              presets={presets}
              size="sm"
              type="range"
              value={[draft.from || null, draft.to || null]}
              onChange={([nextFrom, nextTo]) => setDraft({ from: nextFrom ?? '', to: nextTo ?? '' })}
            />
            <div className="app-date-range-range">
              <TextInput
                className="app-date-range-field"
                label={fromLabel ?? t('Від')}
                type="date"
                data-mantine-stop-propagation
                required={required}
                withAsterisk={false}
                disabled={disabled}
                min={min}
                max={fromMax}
                value={draft.from}
                onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value })}
                data-autofocus
              />
              <TextInput
                className="app-date-range-field"
                label={toLabel ?? t('До')}
                type="date"
                data-mantine-stop-propagation
                required={required}
                withAsterisk={false}
                disabled={disabled}
                min={toMin}
                max={max}
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
              />
            </div>
            {invalidRange ? <span className="app-date-range-error" role="alert">{rangeError}</span> : null}
            <Group justify="flex-end" gap={8}>
              <Button variant="default" data-mantine-stop-propagation onClick={() => setOpened(false)}>{t('Скасувати')}</Button>
              <Button type="submit" data-mantine-stop-propagation disabled={invalidRange || disabled}>{t('Застосувати')}</Button>
            </Group>
          </form>
        </Popover.Dropdown>
      </Popover>
    </div>
  )
}
