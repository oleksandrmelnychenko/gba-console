import { Combobox, InputBase, ScrollArea, useCombobox } from '@mantine/core'
import { useState } from 'react'

export type WizardReviewComboboxOption<T> = {
  entity: T
  key: string
  label: string
}

export function WizardReviewCombobox<T>({
  allowFreeForm = false,
  classNames,
  label,
  onFreeText,
  onSelect,
  options,
  selectedKey,
  tabIndex,
}: {
  allowFreeForm?: boolean
  classNames?: {
    input?: string
    label?: string
    root?: string
  }
  label: string
  onFreeText?: (input: string) => void
  onSelect: (entity: T) => void
  options: WizardReviewComboboxOption<T>[]
  selectedKey: string | null
  tabIndex?: number
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [search, setSearch] = useState<string | null>(null)

  const selectedLabel = options.find((option) => option.key === selectedKey)?.label ?? ''
  const filtered =
    search === null || search === selectedLabel
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))

  function commit(input: string) {
    const match = options.find((option) => option.label.toLowerCase() === input.toLowerCase())

    if (match) {
      onSelect(match.entity)
    } else if (allowFreeForm) {
      if (input) {
        onFreeText?.(input)
      }
    } else if (options.length > 0) {
      onSelect(options[0].entity)
    }

    setSearch(null)
  }

  return (
    <Combobox
      store={combobox}
      withinPortal
      onOptionSubmit={(key) => {
        const option = options.find((item) => item.key === key)

        if (option) {
          onSelect(option.entity)
        }

        setSearch(null)
        combobox.closeDropdown()
      }}
    >
      <Combobox.Target>
        <InputBase
          classNames={classNames}
          label={label}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          tabIndex={tabIndex}
          value={search ?? selectedLabel}
          onBlur={() => {
            combobox.closeDropdown()

            if (search !== null && search !== selectedLabel) {
              commit(search)
            } else {
              setSearch(null)
            }
          }}
          onChange={(event) => {
            setSearch(event.currentTarget.value)
            combobox.openDropdown()
            combobox.updateSelectedOptionIndex()
          }}
          onClick={() => combobox.openDropdown()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setSearch(null)
              combobox.closeDropdown()

              return
            }

            if (event.key !== 'Enter') {
              return
            }

            event.stopPropagation()

            if (combobox.dropdownOpened && combobox.getSelectedOptionIndex() !== -1) {
              return
            }

            event.preventDefault()

            if (search !== null && search !== selectedLabel) {
              commit(search)
            }

            combobox.closeDropdown()
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={240} type="scroll">
            {filtered.map((option) => (
              <Combobox.Option key={option.key} active={option.key === selectedKey} value={option.key}>
                {option.label}
              </Combobox.Option>
            ))}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
