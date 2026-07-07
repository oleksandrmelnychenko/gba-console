import { Checkbox, Combobox, Group, Input, InputBase, ScrollArea, useCombobox } from '@mantine/core'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

type CheckboxMultiSelectOption = {
  value: string
  label: string
}

/**
 * Multi-select rendered as a combobox with a "Вибрано: N" trigger and a
 * checkbox list (plus an "Всі" select-all row) — replaces the pill-style
 * Mantine MultiSelect where a compact count summary is preferred.
 */
export function CheckboxMultiSelect({
  data,
  value,
  onChange,
  label,
  placeholder,
  w,
  searchable = true,
  disabled,
}: {
  data: CheckboxMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  placeholder?: string
  w?: number | string
  searchable?: boolean
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const combobox = useCombobox({ onDropdownClose: () => setSearch('') })

  const allValues = useMemo(() => data.map((item) => item.value), [data])
  const allSelected = allValues.length > 0 && value.length === allValues.length
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return query ? data.filter((item) => item.label.toLowerCase().includes(query)) : data
  }, [data, search])

  function toggle(optionValue: string) {
    onChange(value.includes(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue])
  }

  return (
    <Combobox
      store={combobox}
      position="bottom-start"
      withinPortal
      onOptionSubmit={(optionValue) => {
        if (optionValue === '__all__') {
          onChange(allSelected ? [] : allValues)
        } else {
          toggle(optionValue)
        }
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          disabled={disabled}
          label={label}
          w={w}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
        >
          {value.length ? `${t('Вибрано')}: ${value.length}` : <Input.Placeholder>{placeholder}</Input.Placeholder>}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        {searchable && (
          <Combobox.Search
            value={search}
            placeholder={t('Пошук')}
            leftSection={<Search size={14} />}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        )}
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="scroll">
            {!search.trim() && (
              <Combobox.Option value="__all__" active={allSelected}>
                <Group gap="sm" wrap="nowrap">
                  <Checkbox checked={allSelected} readOnly size="xs" tabIndex={-1} aria-hidden />
                  <span>{t('Всі')}</span>
                </Group>
              </Combobox.Option>
            )}
            {filtered.map((item) => (
              <Combobox.Option key={item.value} value={item.value} active={value.includes(item.value)}>
                <Group gap="sm" wrap="nowrap">
                  <Checkbox checked={value.includes(item.value)} readOnly size="xs" tabIndex={-1} aria-hidden />
                  <span>{item.label}</span>
                </Group>
              </Combobox.Option>
            ))}
            {filtered.length === 0 && <Combobox.Empty>{t('Нічого не знайдено')}</Combobox.Empty>}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
