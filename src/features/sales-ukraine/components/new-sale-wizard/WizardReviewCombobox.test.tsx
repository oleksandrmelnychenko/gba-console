import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardReviewCombobox } from './WizardReviewCombobox'

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
