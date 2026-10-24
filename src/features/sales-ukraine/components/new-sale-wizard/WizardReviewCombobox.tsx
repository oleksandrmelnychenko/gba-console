import { Combobox, InputBase, ScrollArea } from '@mantine/core'
import { useWizardReviewCombobox, type WizardReviewComboboxOptions } from './useWizardReviewCombobox'
export type { WizardReviewComboboxOption } from './useWizardReviewCombobox'

export function WizardReviewCombobox<T>({
  allowFreeForm = false,
  classNames,
  contextKey,
  draftValue,
  label,
  onDraftChange,
  onFreeText,
  onSelect,
  options,
  selectedKey,
  tabIndex,
}: {
  classNames?: {
    input?: string
    label?: string
    root?: string
  }
  label: string
  tabIndex?: number
} & WizardReviewComboboxOptions<T>) {
  const { combobox, filtered, inputValue, handleOptionSubmit, handleBlur, handleChange,
    handleClick, handleKeyDownCapture, handleKeyDown } = useWizardReviewCombobox({
    allowFreeForm, contextKey, draftValue, onDraftChange, onFreeText, onSelect, options, selectedKey,
  })

  return (
    <Combobox
      store={combobox}
      withinPortal
      onOptionSubmit={handleOptionSubmit}
    >
      <Combobox.Target>
        <InputBase
          classNames={classNames}
          data-review-combobox
          label={label}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          tabIndex={tabIndex}
          value={inputValue}
          onBlur={handleBlur}
          onChange={(event) => handleChange(event.currentTarget.value)}
          onClick={handleClick}
          onKeyDownCapture={handleKeyDownCapture}
          onKeyDown={handleKeyDown}
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
