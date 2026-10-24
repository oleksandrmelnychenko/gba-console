import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { WizardReviewCombobox } from './WizardReviewCombobox'

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }))
afterAll(() => {
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

function AddressCombobox({ onFreeText }: { onFreeText: (input: string) => void }) {
  const [draftValue, setDraftValue] = useState('')

  return (
    <WizardReviewCombobox
      allowFreeForm
      draftValue={draftValue}
      label="Адреса"
      options={[]}
      selectedKey={null}
      onDraftChange={setDraftValue}
      onFreeText={onFreeText}
      onSelect={() => undefined}
    />
  )
}

describe('WizardReviewCombobox', () => {
  it('shows the selected option when the controlled draft is empty', () => {
    render(
      <MantineProvider>
        <WizardReviewCombobox
          draftValue=""
          label="Адреса"
          options={[{ entity: { id: 1 }, key: '1', label: 'Київ, 1' }]}
          selectedKey="1"
          onSelect={() => undefined}
        />
      </MantineProvider>,
    )

    expect((screen.getByRole('textbox', { name: 'Адреса' }) as HTMLInputElement).value).toBe('Київ, 1')
  })

  it('keeps a controlled free-text draft visible after blur', () => {
    const onFreeText = vi.fn()

    render(
      <MantineProvider>
        <AddressCombobox onFreeText={onFreeText} />
      </MantineProvider>,
    )

    const input = screen.getByRole('textbox', { name: 'Адреса' }) as HTMLInputElement

    fireEvent.change(input, { target: { value: '222' } })
    fireEvent.blur(input)

    expect(onFreeText).toHaveBeenCalledWith('222')
    expect(input.value).toBe('222')
  })
})

const deliveryOptions = [
  { entity: { id: 1 }, key: '1', label: 'Київ' },
  { entity: { id: 2 }, key: '2', label: 'Львів' },
]

describe('review combobox keyboard ownership', () => {
  it('selects the highlighted option with arrows and Enter without submitting the wizard', () => {
    const onSelect = vi.fn()
    const onWizardKey = vi.fn()
    render(<MantineProvider><div onKeyDown={onWizardKey}>
      <WizardReviewCombobox label="Перевізник" options={deliveryOptions} selectedKey={null} onSelect={onSelect} />
    </div></MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Перевізник' })
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    onWizardKey.mockClear()
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith({ id: 2 })
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onWizardKey).not.toHaveBeenCalled()
  })

  it('commits a free-text recipient only once when Enter is immediately followed by blur', () => {
    const onFreeText = vi.fn()
    render(<MantineProvider>
      <WizardReviewCombobox allowFreeForm label="Одержувач" options={[]} selectedKey={null} onSelect={() => {}} onFreeText={onFreeText} />
    </MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Одержувач' })
    fireEvent.change(input, { target: { value: 'Новий одержувач' } })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      fireEvent.blur(input)
    })
    expect(onFreeText).toHaveBeenCalledExactlyOnceWith('Новий одержувач')
  })

  it('cancels the draft on Escape without creating an address on subsequent blur', () => {
    const onFreeText = vi.fn()
    const onKeyDown = vi.fn()
    render(<MantineProvider><div onKeyDown={onKeyDown}><AddressCombobox onFreeText={onFreeText} /></div></MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Адреса' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'draft' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    fireEvent.blur(input)
    expect(input.value).toBe('')
    expect(onFreeText).not.toHaveBeenCalled()
    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it('does not submit a highlighted option on held Enter, composition or modifier combinations', () => {
    const onSelect = vi.fn()
    const onFreeText = vi.fn()
    render(<MantineProvider>
      <WizardReviewCombobox allowFreeForm label="Одержувач" options={deliveryOptions} selectedKey={null} onSelect={onSelect} onFreeText={onFreeText} />
    </MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Одержувач' })
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    for (const extra of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }]) {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', ...extra })
    }
    expect(onSelect).not.toHaveBeenCalled()
    expect(onFreeText).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ id: 1 })
  })

  it('preserves native Tab and global Alt step shortcuts', () => {
    const onKeyDown = vi.fn()
    render(<MantineProvider><div onKeyDown={onKeyDown}>
      <WizardReviewCombobox label="Перевізник" options={deliveryOptions} selectedKey={null} onSelect={() => {}} />
    </div></MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Перевізник' })
    expect(fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: '1', code: 'Digit1', altKey: true })).toBe(true)
    expect(onKeyDown).toHaveBeenCalledTimes(2)
  })

  it('retires a draft when the recipient context changes, even with the same selected address key', () => {
    const onFreeText = vi.fn()
    const props = { allowFreeForm: true, label: 'Адреса', options: deliveryOptions, selectedKey: '1', onSelect: vi.fn(), onFreeText }
    const ui = render(<MantineProvider><WizardReviewCombobox {...props} contextKey="recipient-a" /></MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Адреса' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'old draft' } })
    ui.rerender(<MantineProvider><WizardReviewCombobox {...props} contextKey="recipient-b" /></MantineProvider>)
    expect(input.value).toBe('Київ')
    fireEvent.blur(input)
    expect(onFreeText).not.toHaveBeenCalled()
    ui.rerender(<MantineProvider><WizardReviewCombobox {...props} contextKey="recipient-a" /></MantineProvider>)
    expect(input.value).toBe('Київ')
  })

  it('filters case-insensitively, chooses an exact match and never creates whitespace-only entries', () => {
    const onSelect = vi.fn()
    const onFreeText = vi.fn()
    render(<MantineProvider>
      <WizardReviewCombobox allowFreeForm label="Адреса" options={deliveryOptions} selectedKey={null} onSelect={onSelect} onFreeText={onFreeText} />
    </MantineProvider>)
    const input = screen.getByRole('textbox', { name: 'Адреса' })
    fireEvent.change(input, { target: { value: 'львів' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.blur(input)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ id: 2 })
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(onFreeText).not.toHaveBeenCalled()
  })
})
