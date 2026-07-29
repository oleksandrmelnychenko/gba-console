import {
  Select,
  type AutocompleteProps,
  type ComboboxItem,
} from '@mantine/core'
import type { ReactNode } from 'react'

export interface SearchableSelectProps extends AutocompleteProps {
  nothingFoundMessage?: ReactNode
  selectionPlaceholder?: string
}

interface SearchableOption extends ComboboxItem {
  disabled?: boolean
}

/**
 * Standard Mantine Select with the legacy autocomplete callback contract.
 *
 * Consumers keep their existing async lookup state, while the rendered
 * control behaves and looks exactly like every other searchable Select.
 */
export function SearchableSelect({
  className,
  clearable = true,
  comboboxProps,
  data,
  defaultDropdownOpened,
  disabled,
  dropdownOpened,
  label,
  leftSection,
  limit,
  maxLength,
  maxDropdownHeight = 280,
  nothingFoundMessage = 'Нічого не знайдено',
  onBlur,
  onChange,
  onClear,
  onDropdownClose,
  onDropdownOpen,
  onOptionSubmit,
  renderOption,
  rightSection,
  selectionPlaceholder = 'Оберіть значення',
  style,
  value = '',
}: SearchableSelectProps) {
  const options = normalizeOptions(data)
  const selectedOption = findOptionByLabel(options, value)
  const resolvedClassName = className
    ? `app-searchable-select ${className}`
    : 'app-searchable-select'

  return (
    <Select
      allowDeselect={false}
      className={resolvedClassName}
      clearable={clearable}
      comboboxProps={comboboxProps}
      data={options}
      defaultDropdownOpened={defaultDropdownOpened}
      disabled={disabled}
      dropdownOpened={dropdownOpened}
      label={label}
      leftSection={leftSection}
      limit={limit}
      maxDropdownHeight={maxDropdownHeight}
      maxLength={maxLength}
      nothingFoundMessage={nothingFoundMessage}
      placeholder={selectionPlaceholder}
      renderOption={renderOption}
      rightSection={rightSection}
      searchable
      style={style}
      value={selectedOption?.value ?? null}
      onBlur={onBlur}
      onChange={(nextValue, option) => {
        if (nextValue === null) {
          onChange?.('')
          return
        }

        onChange?.(option.label)
        onOptionSubmit?.(nextValue)
      }}
      onClear={onClear}
      onDropdownClose={onDropdownClose}
      onDropdownOpen={onDropdownOpen}
      onSearchChange={(search) => {
        if (search !== selectedOption?.label) {
          onChange?.(search)
        }
      }}
    />
  )
}

function findOptionByLabel(options: SearchableOption[], label: string | undefined) {
  if (!label) {
    return null
  }

  return options.find((option) => option.label === label) || null
}

function normalizeOptions(data: AutocompleteProps['data']): SearchableOption[] {
  if (!data) {
    return []
  }

  return data.flatMap((item) => {
    if (typeof item === 'string') {
      return [{ label: item, value: item }]
    }

    if ('items' in item) {
      return normalizeOptions(item.items)
    }

    return [{
      disabled: item.disabled,
      label: 'label' in item ? String(item.label) : String(item.value),
      value: String(item.value),
    }]
  })
}
