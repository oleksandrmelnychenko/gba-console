import { CloseButton, Combobox, InputBase, ScrollArea, useCombobox } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { searchSalesUkraineClients } from '../api/salesUkraineApi'
import type { SalesUkraineClientOption } from '../types'

const MIN_QUERY_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 300

function getClientOptionLabel(client: SalesUkraineClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || ''
  )
}

function getClientOptionValue(client: SalesUkraineClientOption): string {
  return String(client.Id ?? client.NetUid ?? '')
}

export function SalesClientSearch({
  className,
  label,
  placeholder,
  value,
  onChange,
}: {
  className?: string
  label?: string
  placeholder?: string
  value: string
  onChange: (clientId: string) => void
}) {
  const { t } = useI18n()
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<SalesUkraineClientOption[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [previousValue, setPreviousValue] = useState(value)

  // Reset the input when the selection is cleared from the outside (e.g. the filters reset).
  if (value !== previousValue) {
    setPreviousValue(value)

    if (!value) {
      setSearch('')
      setSelectedLabel('')
    }
  }

  useEffect(() => {
    const query = search.trim()

    if (query.length < MIN_QUERY_LENGTH || query === selectedLabel) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(query)

        if (!cancelled) {
          setOptions(next)
        }
      } catch {
        if (!cancelled) {
          setOptions([])
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [search, selectedLabel])

  function clearSelection() {
    setSearch('')
    setOptions([])
    setSelectedLabel('')
    onChange('')
  }

  const query = search.trim()
  const optionNodes = options.map((client) => {
    const optionValue = getClientOptionValue(client)

    return (
      <Combobox.Option key={optionValue} active={optionValue === value} value={optionValue}>
        {getClientOptionLabel(client)}
      </Combobox.Option>
    )
  })

  return (
    <Combobox
      store={combobox}
      withinPortal
      onOptionSubmit={(optionValue) => {
        const client = options.find((item) => getClientOptionValue(item) === optionValue)
        const optionLabel = client ? getClientOptionLabel(client) : ''

        setSelectedLabel(optionLabel)
        setSearch(optionLabel)
        onChange(optionValue)
        combobox.closeDropdown()
      }}
    >
      <Combobox.Target>
        <InputBase
          className={className}
          label={label}
          placeholder={placeholder}
          rightSection={
            value || search ? (
              <CloseButton
                aria-label={t('Скинути')}
                size="sm"
                onClick={clearSelection}
                onMouseDown={(event) => event.preventDefault()}
              />
            ) : (
              <Combobox.Chevron />
            )
          }
          rightSectionPointerEvents={value || search ? 'all' : 'none'}
          size="sm"
          value={search}
          onBlur={() => combobox.closeDropdown()}
          onChange={(event) => {
            setSelectedLabel('')
            setSearch(event.currentTarget.value)
            combobox.openDropdown()
            combobox.updateSelectedOptionIndex()
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={240} type="scroll">
            {query.length < MIN_QUERY_LENGTH ? (
              <Combobox.Empty>{t('Введіть мінімум 2 символи')}</Combobox.Empty>
            ) : optionNodes.length ? (
              optionNodes
            ) : (
              <Combobox.Empty>{t('Нічого не знайдено')}</Combobox.Empty>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
