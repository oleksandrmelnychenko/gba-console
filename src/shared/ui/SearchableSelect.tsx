import {
  Select,
  type AutocompleteProps,
  type ComboboxItem,
} from '@mantine/core'
import { useRef, useState, type ReactNode } from 'react'

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
  filter,
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
  required,
  renderOption,
  rightSection,
  selectionPlaceholder = 'Оберіть значення',
  style,
  value = '',
}: SearchableSelectProps) {
  // The option the user picked last. Consumers usually refresh their lookup
  // with the picked label; if that answer no longer contains the option, the
  // select would lose its value and clear the field (and the consumer's pick).
  const [pickedOption, setPickedOption] = useState<SearchableOption | null>(null)
  // Label already reported to the consumer for the option being submitted, so
  // Mantine's own onChange echo does not report it a second time.
  const submittedLabelRef = useRef<string | null>(null)
  const options = withPickedOption(normalizeOptions(data), pickedOption, value)
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
      filter={filter}
      label={label}
      leftSection={leftSection}
      limit={limit}
      maxDropdownHeight={maxDropdownHeight}
      maxLength={maxLength}
      nothingFoundMessage={nothingFoundMessage}
      placeholder={selectionPlaceholder}
      required={required}
      renderOption={renderOption}
      rightSection={rightSection}
      searchable
      style={style}
      value={selectedOption?.value ?? null}
      onBlur={onBlur}
      onChange={(nextValue, option) => {
        if (nextValue === null) {
          setPickedOption(null)
          onChange?.('')
          return
        }

        const nextLabel = option?.label ?? nextValue

        if (submittedLabelRef.current === nextLabel) {
          submittedLabelRef.current = null
          return
        }

        onChange?.(nextLabel)
      }}
      onClear={onClear}
      onDropdownClose={onDropdownClose}
      onDropdownOpen={onDropdownOpen}
      onOptionSubmit={(submittedValue) => {
        const option = options.find((item) => item.value === submittedValue)

        if (option) {
          setPickedOption(option)
          submittedLabelRef.current = option.label
          // Text first, pick second: a consumer that clears its pick on every
          // text change still ends up with the pick, not an empty selection.
          onChange?.(option.label)
        }

        onOptionSubmit?.(submittedValue)
      }}
      onSearchChange={(search) => {
        if (search !== selectedOption?.label) {
          onChange?.(search)
        }
      }}
    />
  )
}

function withPickedOption(
  options: SearchableOption[],
  pickedOption: SearchableOption | null,
  value: string | undefined,
) {
  if (!pickedOption || !value || pickedOption.label !== value) {
    return options
  }

  return options.some((option) => option.label === value)
    ? options
    : [pickedOption, ...options]
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
