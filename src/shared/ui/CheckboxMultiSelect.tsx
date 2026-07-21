import { Checkbox, Combobox, Group, Input, InputBase, ScrollArea, useCombobox } from '@mantine/core'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import './checkbox-multi-select.css'

export const CHECKBOX_MULTI_SELECT_WIDTH = 'var(--app-multi-select-width, 240px)'

type CheckboxMultiSelectOption = {
  value: string
  label: string
}

/**
 * Fixed-width multi-select: placeholder for zero values, the option label for
 * one value, and a compact selected-count summary for multiple values.
 */
export function CheckboxMultiSelect({
  data,
  value,
  onChange,
  label,
  placeholder,
  className,
  limit,
  maxDropdownHeight = 260,
  searchable = true,
  disabled,
}: {
  data: CheckboxMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  placeholder?: string
  className?: string
  limit?: number
  maxDropdownHeight?: number
  searchable?: boolean
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const combobox = useCombobox({ onDropdownClose: () => setSearch('') })

  const allValues = useMemo(() => data.map((item) => item.value), [data])
  const selectedValues = useMemo(() => new Set(value), [value])
  const allSelected = allValues.length > 0 && allValues.every((optionValue) => selectedValues.has(optionValue))
  const singleSelectedLabel = value.length === 1 ? data.find((item) => item.value === value[0])?.label : undefined
  const summary = value.length === 1
    ? singleSelectedLabel || `${t('Вибрано')}: 1`
    : `${t('Вибрано')}: ${value.length}`
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return query ? data.filter((item) => item.label.toLowerCase().includes(query)) : data
  }, [data, search])
  const visibleOptions = typeof limit === 'number' ? filtered.slice(0, Math.max(0, limit)) : filtered

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
          className={className ? `checkbox-multi-select ${className}` : 'checkbox-multi-select'}
          component="button"
          type="button"
          pointer
          disabled={disabled}
          label={label}
          maw={CHECKBOX_MULTI_SELECT_WIDTH}
          miw={CHECKBOX_MULTI_SELECT_WIDTH}
          style={{ flex: `0 0 ${CHECKBOX_MULTI_SELECT_WIDTH}` }}
          w={CHECKBOX_MULTI_SELECT_WIDTH}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
        >
          {value.length ? (
            <span className="checkbox-multi-select__summary" title={summary}>{summary}</span>
          ) : (
            <Input.Placeholder>{placeholder}</Input.Placeholder>
          )}
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
          <ScrollArea.Autosize mah={maxDropdownHeight} type="scroll">
            {!search.trim() && (
              <Combobox.Option value="__all__" active={allSelected}>
                <Group gap="sm" wrap="nowrap">
                  <Checkbox checked={allSelected} readOnly size="xs" tabIndex={-1} aria-hidden />
                  <span>{t('Всі')}</span>
                </Group>
              </Combobox.Option>
            )}
            {visibleOptions.map((item) => (
              <Combobox.Option key={item.value} value={item.value} active={value.includes(item.value)}>
                <Group gap="sm" wrap="nowrap">
                  <Checkbox checked={selectedValues.has(item.value)} readOnly size="xs" tabIndex={-1} aria-hidden />
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
