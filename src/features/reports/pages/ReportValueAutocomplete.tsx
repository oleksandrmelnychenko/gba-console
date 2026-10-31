import { Button, Checkbox, Combobox, Group, InputBase, Loader, ScrollArea, Stack, useCombobox } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'

type Option = { value: string; label: string }

/** The selected identities are independent of the current lookup page and search. */
export function ReportValueAutocomplete({ data, selected, search, onSearchChange, onChange, label, loading,
  disabled, remote = true, emptyMessage, error, withinPortal = false, clearSearchOnClose = true,
}: {
  data: Option[]; selected: Option[]; search: string; onSearchChange: (value: string) => void
  onChange: (keys: string[]) => void; label?: string; loading?: boolean; disabled?: boolean
  remote?: boolean; emptyMessage?: string; error?: string; withinPortal?: boolean; clearSearchOnClose?: boolean
}) {
  const { t } = useI18n()
  const [selectedOnly, setSelectedOnly] = useState(false)
  const combobox = useCombobox({ onDropdownClose: () => { if (clearSearchOnClose) onSearchChange(''); setSelectedOnly(false); combobox.resetSelectedOption() } })
  const keys = new Set(selected.map(item => item.value))
  const query = search.trim().toLocaleLowerCase('uk')
  const options = selectedOnly ? selected : query ? data : [...new Map([...selected, ...data].map(item => [item.value, item])).values()]
  const visible = selectedOnly || !remote ? options.filter(item => item.label.toLocaleLowerCase('uk').includes(query)) : options
  return <Stack gap={4}>
    <Combobox store={combobox} withinPortal={withinPortal} onOptionSubmit={key => {
      onChange(keys.has(key) ? selected.filter(item => item.value !== key).map(item => item.value) : [...keys, key])
      combobox.updateSelectedOptionIndex()
    }}>
      <Combobox.Target>
        <InputBase role="combobox" aria-expanded={combobox.dropdownOpened} label={label} value={search} disabled={disabled} error={error}
          placeholder={t('Пошук значення')} rightSection={loading && !selectedOnly ? <Loader size="xs" /> : <Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onFocus={() => combobox.openDropdown()} onBlur={() => combobox.closeDropdown()} onClick={() => combobox.openDropdown()}
          onChange={event => { onSearchChange(event.currentTarget.value); combobox.openDropdown(); combobox.updateSelectedOptionIndex() }} />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="auto">
            {visible.map(item => <Combobox.Option key={item.value} value={item.value} active={keys.has(item.value)}>
              <Group gap="xs" wrap="nowrap"><Checkbox checked={keys.has(item.value)} readOnly size="xs" tabIndex={-1} aria-hidden />
                <span>{item.label}</span></Group>
            </Combobox.Option>)}
            {!visible.length ? <Combobox.Empty>{loading && !selectedOnly ? t('Завантаження…') : emptyMessage ?? t('Нічого не знайдено')}</Combobox.Empty> : null}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
    {selected.length ? <Button type="button" variant="subtle" size="compact-sm" disabled={disabled}
      aria-pressed={selectedOnly} onClick={() => { setSelectedOnly(value => !value); onSearchChange(''); combobox.openDropdown() }}
      style={{ alignSelf: 'flex-start' }}>{t('Вибрано')}: {selected.length}</Button> : null}
  </Stack>
}
