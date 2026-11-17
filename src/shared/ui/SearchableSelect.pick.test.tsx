import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from './SearchableSelect'

type Person = { id: string; name: string }

const people: Person[] = [
  { id: 'u-1', name: 'QA finance' },
  { id: 'u-2', name: 'QA logistic' },
]

/**
 * The lookup pattern of the cash-order and consumable-order forms: every text
 * change clears the pick, the pick is set on option submit, and the list is
 * refreshed from the server with the current text (here the server does not
 * find the full label, as the colleague search does not).
 */
function LookupForm({ onSearch }: { onSearch: (value: string) => void }) {
  const [form, setForm] = useState({ search: '', pickedId: '' })
  const [items, setItems] = useState<Person[]>([])

  useEffect(() => {
    const value = form.search.trim()

    if (!value) {
      return
    }

    onSearch(value)
    void Promise.resolve().then(() => {
      setItems(people.filter((person) => value.length < 6 && person.name.toLowerCase().includes(value.toLowerCase())))
    })
  }, [form.search, onSearch])

  return (
    <>
      <SearchableSelect
        data={items.map((item) => ({ label: item.name, value: item.id }))}
        label="Колега"
        value={form.search}
        onChange={(value) => setForm((current) => ({ ...current, pickedId: '', search: value }))}
        onOptionSubmit={(value) => {
          const person = items.find((item) => item.id === value)

          if (person) {
            setForm((current) => ({ ...current, pickedId: person.id, search: person.name }))
          }
        }}
      />
      <output data-testid="picked">{form.pickedId}</output>
    </>
  )
}

function renderLookup() {
  const onSearch = vi.fn()

  render(
    <MantineProvider>
      <LookupForm onSearch={onSearch} />
    </MantineProvider>,
  )

  return { onSearch, select: screen.getByRole('combobox', { name: 'Колега' }) }
}

describe('SearchableSelect keeps the pick', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  it('keeps an option picked with the mouse after the lookup refreshes without it', async () => {
    const user = userEvent.setup()
    const { select } = renderLookup()

    await user.click(select)
    await user.type(select, 'fin')
    await user.click(await screen.findByRole('option', { hidden: true, name: 'QA finance' }))
    await act(async () => {})

    expect(screen.getByTestId('picked').textContent).toBe('u-1')
    await waitFor(() => expect((select as HTMLInputElement).value).toBe('QA finance'))
    expect(screen.getByTestId('picked').textContent).toBe('u-1')
  })

  it('keeps an option picked with ArrowDown + Enter', async () => {
    const user = userEvent.setup()
    const { select } = renderLookup()

    await user.click(select)
    await user.type(select, 'logi')
    await screen.findByRole('option', { hidden: true, name: 'QA logistic' })
    await user.keyboard('{ArrowDown}{Enter}')
    await act(async () => {})

    expect(screen.getByTestId('picked').textContent).toBe('u-2')
    expect((select as HTMLInputElement).value).toBe('QA logistic')
  })

  it('reports the picked label to onChange once, before onOptionSubmit', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const data = [{ label: 'QA Сервіс Постачальник', value: 'org-1' }]

    render(
      <MantineProvider>
        <SearchableSelect
          data={data}
          label="Постачальник послуг"
          value=""
          onChange={(value) => calls.push(`change:${value}`)}
          onOptionSubmit={(value) => calls.push(`submit:${value}`)}
        />
      </MantineProvider>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Постачальник послуг' }))
    await user.click(screen.getByRole('option', { hidden: true, name: 'QA Сервіс Постачальник' }))

    expect(calls.filter((call) => call !== 'change:')).toEqual(['change:QA Сервіс Постачальник', 'submit:org-1'])
  })

  it('clears the pick when the user edits the text afterwards', async () => {
    const user = userEvent.setup()
    const { select } = renderLookup()

    await user.click(select)
    await user.type(select, 'fin')
    await user.click(await screen.findByRole('option', { hidden: true, name: 'QA finance' }))
    await act(async () => {})
    await user.type(select, '{Backspace}')

    expect(screen.getByTestId('picked').textContent).toBe('')
  })
})
