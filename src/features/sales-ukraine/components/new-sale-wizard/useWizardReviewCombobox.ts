import { useCombobox } from '@mantine/core'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export type WizardReviewComboboxOption<T> = { entity: T; key: string; label: string }
export type WizardReviewComboboxOptions<T> = {
  allowFreeForm?: boolean
  contextKey?: string
  draftValue?: string
  onDraftChange?: (input: string) => void
  onFreeText?: (input: string) => void
  onSelect: (entity: T) => void
  options: WizardReviewComboboxOption<T>[]
  selectedKey: string | null
}

export function useWizardReviewCombobox<T>(props: WizardReviewComboboxOptions<T>) {
  const { options, selectedKey, contextKey = '', draftValue } = props
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const scope = JSON.stringify([contextKey, selectedKey])
  const [draft, setDraft] = useState<{ scope: string; search: string | null }>({ scope, search: null })
  const search = draft.scope === scope ? draft.search : null
  if (draft.scope !== scope) setDraft({ scope, search: null })
  const searchRef = useRef<string | null>(null)
  const selectedLabel = useMemo(() => options.find((option) => option.key === selectedKey)?.label ?? '', [options, selectedKey])
  const latestRef = useRef({ ...props, scope, selectedLabel, combobox })
  useLayoutEffect(() => { latestRef.current = { ...props, scope, selectedLabel, combobox } })
  useLayoutEffect(() => {
    searchRef.current = null
    latestRef.current.combobox.closeDropdown()
  }, [scope])

  const indexed = useMemo(() => options.map((option) => ({ option, lowerLabel: option.label.toLowerCase() })), [options])
  const filtered = useMemo(() => {
    if (search === null || search === selectedLabel) return options
    const query = search.toLowerCase()
    return indexed.filter((item) => item.lowerLabel.includes(query)).map((item) => item.option)
  }, [indexed, options, search, selectedLabel])
  const setSearch = useCallback((value: string | null) => {
    searchRef.current = value
    setDraft({ scope: latestRef.current.scope, search: value })
  }, [])
  const commit = useCallback(() => {
    const input = searchRef.current
    const current = latestRef.current
    // Retire the draft before invoking callbacks: Enter followed immediately
    // by blur must not create the same recipient/address twice.
    setSearch(null)
    if (input === null || input === current.selectedLabel) return
    const match = current.options.find((option) => option.label.toLowerCase() === input.toLowerCase())
    if (match) current.onSelect(match.entity)
    else if (current.allowFreeForm) {
      if (input.trim()) current.onFreeText?.(input)
    } else if (current.options[0]) current.onSelect(current.options[0].entity)
  }, [setSearch])
  const handleOptionSubmit = useCallback((key: string) => {
    const current = latestRef.current
    const option = current.options.find((item) => item.key === key)
    setSearch(null)
    current.combobox.closeDropdown()
    if (option) current.onSelect(option.entity)
  }, [setSearch])
  const handleBlur = useCallback(() => { latestRef.current.combobox.closeDropdown(); commit() }, [commit])
  const handleChange = useCallback((input: string) => {
    setSearch(input)
    const current = latestRef.current
    current.onDraftChange?.(input)
    current.combobox.openDropdown()
    current.combobox.updateSelectedOptionIndex()
  }, [setSearch])
  const handleClick = useCallback(() => latestRef.current.combobox.openDropdown(), [])
  const handleKeyDownCapture = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    // Mantine's target invokes its keyboard handler after the child handler
    // even when defaultPrevented. Stop these events in capture instead.
    const modifiedChoice = (event.ctrlKey || event.metaKey || event.altKey) && ['Enter', 'Escape', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || modifiedChoice) {
      event.stopPropagation()
    } else if (event.repeat && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    const current = latestRef.current
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setSearch(null)
      current.onDraftChange?.('')
      current.combobox.closeDropdown()
    } else if (event.key === 'Enter') {
      event.stopPropagation()
      // Let Mantine submit its highlighted option and maintain ARIA state.
      if (current.combobox.dropdownOpened && current.combobox.getSelectedOptionIndex() !== -1) return
      event.preventDefault()
      commit()
      current.combobox.closeDropdown()
    }
  }, [commit, setSearch])

  return { combobox, filtered, inputValue: search ?? (draftValue || selectedLabel), handleOptionSubmit,
    handleBlur, handleChange, handleClick, handleKeyDownCapture, handleKeyDown }
}
