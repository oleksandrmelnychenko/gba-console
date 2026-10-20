import { ActionIcon, Button, Group, Popover, TextInput, Tooltip } from '@mantine/core'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import './toolbar-date-range-filter.css'

type Props = {
  from: string
  to: string
  min?: string
  max?: string
  disabled?: boolean
  fromLabel?: string
  toLabel?: string
  onChange: (range: { from: string; to: string }) => void
}

function displayDate(value: string) {
  return value ? value.split('-').reverse().join('.') : '…'
}

export function ToolbarDateRangeFilter({ from, to, min, max, disabled, fromLabel, toLabel, onChange }: Props) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState({ from, to })
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to)
  const summary = from || to ? `${displayDate(from)} — ${displayDate(to)}` : t('Увесь період')
  const fromMax = [draft.to, max].filter(Boolean).sort()[0]
  const toMin = [draft.from, min].filter(Boolean).sort().at(-1)

  function changeOpened(next: boolean) {
    if (next) setDraft({ from, to })
    setOpened(next)
  }

  return (
    <div className="app-date-range-icon-wrap">
      <Popover opened={opened} onChange={changeOpened} position="bottom-start" width={340} withinPortal trapFocus returnFocus shadow="md">
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
        <Popover.Dropdown className="app-date-range-menu" role="dialog" aria-label={t('Період')}>
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
            <div className="app-date-range-range">
              <TextInput
                className="app-date-range-field"
                label={fromLabel ?? t('Від')}
                type="date"
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
                disabled={disabled}
                min={toMin}
                max={max}
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
              />
            </div>
            {invalidRange ? <span className="app-date-range-error" role="alert">{t('Дата «Від» має бути не пізніше дати «До»')}</span> : null}
            <Group justify="flex-end" gap={8}>
              <Button variant="default" onClick={() => setOpened(false)}>{t('Скасувати')}</Button>
              <Button type="submit" disabled={invalidRange || disabled}>{t('Застосувати')}</Button>
            </Group>
          </form>
        </Popover.Dropdown>
      </Popover>
    </div>
  )
}
