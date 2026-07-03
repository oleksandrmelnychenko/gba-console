import { CloseButton, Combobox, InputBase, ScrollArea, useCombobox } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
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
  const selectedLabelRef = useRef('')
  const valueRef = useRef(value)

  useEffect(() => {
    const previousValue = valueRef.current
    valueRef.current = value

    if (previousValue && !value) {
      selectedLabelRef.current = ''

      const handle = window.setTimeout(() => setSearch(''), 0)

      return () => window.clearTimeout(handle)
    }
  }, [value])

  useEffect(() => {
    const query = search.trim()

    if (query.length < MIN_QUERY_LENGTH || query === selectedLabelRef.current) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(query, controller.signal)

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
      controller.abort()
      clearTimeout(handle)
    }
  }, [search])

  function clearSelection() {
    setSearch('')
    setOptions([])
    selectedLabelRef.current = ''
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
      classNames={{
        dropdown: 'sales-filter-dropdown',
        option: 'sales-filter-dropdown-option',
        options: 'sales-filter-dropdown-options',
      }}
      store={combobox}
      withinPortal
      onOptionSubmit={(optionValue) => {
        const client = options.find((item) => getClientOptionValue(item) === optionValue)
        const optionLabel = client ? getClientOptionLabel(client) : ''

        selectedLabelRef.current = optionLabel
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
            selectedLabelRef.current = ''
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
