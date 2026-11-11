import { Button, Checkbox, CloseButton, Combobox, Group, InputBase, Loader, ScrollArea, Stack, Text, useCombobox } from '@mantine/core'
import { useRef, useState, type KeyboardEvent } from 'react'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useI18n } from '../../../shared/i18n/useI18n'
import { REPORT_VALUE_VISIBLE_PILLS } from './reportValueSearch'

export type ReportValueOption = { value: string; label: string }

const MORE_OPTION = '\u0000report-value-more'
const RETRY_OPTION = '\u0000report-value-retry'

export type ReportValuePickerProps = {
  mode: 'single' | 'multi'
  data: ReportValueOption[]
  selected: ReportValueOption[]
  search: string
  onSearchChange: (value: string) => void
  onChange: (keys: string[], chosen?: string) => void
  label?: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  readOnly?: boolean
  remote?: boolean
  emptyMessage?: string
  error?: string
  lookupError?: string
  onRetry?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onAddText?: (text: string) => void
}

export function ReportValuePicker({
  mode, data, selected, search, onSearchChange, onChange, label, placeholder, loading, disabled, readOnly,
  remote = true, emptyMessage, error, lookupError, onRetry, hasMore, loadingMore, onLoadMore, onAddText,
}: ReportValuePickerProps) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const combobox = useCombobox({ onDropdownClose: () => { setSelectedOnly(false); combobox.resetSelectedOption() } })
  const freeText = !!onAddText
  const locked = !!disabled || !!readOnly
  const keys = new Set(selected.map(item => item.value))
  const query = search.trim().toLocaleLowerCase('uk')
  const merged = mode === 'multi' && !query ? [...new Map([...selected, ...data].map(item => [item.value, item])).values()] : data
  const options = selectedOnly ? selected : merged
  const visible = selectedOnly || !remote ? options.filter(item => item.label.toLocaleLowerCase('uk').includes(query)) : options
  const busy = !!loading && !selectedOnly
  const paging = !selectedOnly && !busy && !!hasMore && !!onLoadMore
  const failed = !selectedOnly && !busy && !!lookupError
  const retrying = failed && !!onRetry

  function remove(key: string) {
    onChange(selected.filter(item => item.value !== key).map(item => item.value))
  }
  function submit(key: string) {
    if (locked) return
    if (key === MORE_OPTION) { onLoadMore?.(); return }
    if (key === RETRY_OPTION) { onRetry?.(); return }
    if (selectedOnly) { remove(key); combobox.updateSelectedOptionIndex(); return }
    if (mode === 'multi') {
      onChange(keys.has(key) ? selected.filter(item => item.value !== key).map(item => item.value) : [...keys, key])
      combobox.updateSelectedOptionIndex()
      return
    }
    onChange([key], key)
    onSearchChange('')
    combobox.closeDropdown()
  }
  function addText() {
    const text = search.trim()
    if (locked || !text) return
    onAddText?.(text)
    onSearchChange('')
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (locked) return
    if (freeText && event.key === 'Enter') { event.preventDefault(); addText(); return }
    if (event.key === 'Backspace' && !event.repeat && search === '' && selected.length)
      remove(selected[selected.length - 1].value)
  }
  function blur() {
    combobox.closeDropdown()
    if (search !== '') onSearchChange('')
  }
  function open() {
    if (!locked && !freeText) combobox.openDropdown()
  }

  const field = <InputBase ref={input} aria-autocomplete={freeText ? undefined : 'list'} label={label} value={search} disabled={disabled} readOnly={readOnly} error={error}
    placeholder={placeholder ?? (freeText ? t('Введіть значення і натисніть Enter') : t('Пошук значення'))}
    rightSection={freeText ? undefined : busy ? <Loader size="xs" /> : <Combobox.Chevron />} rightSectionPointerEvents="none"
    onFocus={open} onClick={open} onBlur={blur} onKeyDown={keyDown}
    onChange={event => {
      onSearchChange(event.currentTarget.value)
      if (!freeText) { combobox.openDropdown(); combobox.updateSelectedOptionIndex() }
    }} />

  return <Stack gap={4} className="report-value-picker" data-mode={freeText ? 'text' : mode}>
    {freeText
      ? <Group align="end" gap={6} wrap="nowrap">
          <div style={{ flex: 1, minWidth: 0 }}>{field}</div>
          <Button type="button" size="sm" color={CREATE_ACTION_COLOR} disabled={locked}
            onMouseDown={event => event.preventDefault()} onClick={addText}>{t('Додати')}</Button>
        </Group>
      : <Combobox store={combobox} withinPortal readOnly={locked} onOptionSubmit={submit}>
          <Combobox.Target withExpandedAttribute>{field}</Combobox.Target>
          <Combobox.Dropdown>
            <Combobox.Options aria-label={label ?? t('Значення')}>
              <ScrollArea.Autosize mah={260} type="auto" viewportProps={{ tabIndex: -1 }}>
                {visible.map(item => <Combobox.Option key={item.value} value={item.value} active={keys.has(item.value)} disabled={locked}>
                  <Group gap="xs" wrap="nowrap">
                    {mode === 'multi' || selectedOnly ? <Checkbox checked={keys.has(item.value)} readOnly size="xs" tabIndex={-1} aria-hidden /> : null}
                    <span>{item.label}</span>
                  </Group>
                </Combobox.Option>)}
                {failed ? combobox.dropdownOpened ? <Combobox.Empty role="alert" c="red">{lookupError}</Combobox.Empty> : null
                  : !visible.length ? <Combobox.Empty>{busy ? t('Завантаження…') : emptyMessage ?? t('Нічого не знайдено')}</Combobox.Empty> : null}
                {paging ? <Combobox.Option value={MORE_OPTION} disabled={loadingMore} className="report-value-picker__action">
                  <Group gap="xs" wrap="nowrap">{loadingMore ? <Loader size="xs" /> : null}<span>{t('Ще значення')}</span></Group>
                </Combobox.Option> : null}
                {retrying ? <Combobox.Option value={RETRY_OPTION} className="report-value-picker__action">{t('Спробувати ще раз')}</Combobox.Option> : null}
              </ScrollArea.Autosize>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>}
    {lookupError && !(failed && combobox.dropdownOpened)
      ? <Text size="xs" c="red" role="alert" className="report-value-picker__lookup-error">{lookupError}</Text> : null}
    {selected.length ? <Group gap={4} className="report-value-picker__selected">
      <Button type="button" variant="subtle" size="compact-sm" disabled={disabled || freeText} aria-pressed={selectedOnly}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (freeText) return
          setSelectedOnly(value => !value)
          onSearchChange('')
          input.current?.focus()
          combobox.openDropdown()
        }}>{t('Вибрано')}: {selected.length}</Button>
      {selected.slice(0, REPORT_VALUE_VISIBLE_PILLS).map(item => <span key={item.value} className="report-value-picker__pill"
        title={item.label} data-disabled={disabled || undefined}>
        <span className="report-value-picker__pill-label">{item.label}</span>
        {locked ? null : <CloseButton size="xs" type="button" aria-label={`${t('Видалити')} ${item.label}`}
          onMouseDown={event => event.preventDefault()} onClick={() => remove(item.value)} />}
      </span>)}
      {selected.length > REPORT_VALUE_VISIBLE_PILLS
        ? <Text size="xs" c="dimmed">{t('ще')} {selected.length - REPORT_VALUE_VISIBLE_PILLS}</Text> : null}
    </Group> : null}
  </Stack>
}
