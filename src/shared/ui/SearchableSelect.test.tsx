import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from './SearchableSelect'

describe('SearchableSelect', () => {
  it('renders the standard searchable select and submits the selected option value', () => {
    const handleChange = vi.fn()
    const handleOptionSubmit = vi.fn()
    const data = [{ label: 'Склад Вітрина', value: 'storage-1' }]

    render(
      <MantineProvider>
        <SearchableSelect
          data={data}
          label="Склад"
          value=""
          onChange={handleChange}
          onOptionSubmit={handleOptionSubmit}
        />
      </MantineProvider>,
    )

    const select = screen.getByRole('combobox', { name: 'Склад' })

    expect(select.tagName).toBe('INPUT')
    expect(select.getAttribute('placeholder')).toBe('Оберіть значення')

    fireEvent.click(select)
    fireEvent.click(screen.getByText('Склад Вітрина'))

    expect(handleOptionSubmit).toHaveBeenCalledWith('storage-1')
    expect(handleChange).toHaveBeenCalledWith('Склад Вітрина')
  })

  it('submits an option when the typed search already exactly matches its label', () => {
    const handleChange = vi.fn()
    const handleOptionSubmit = vi.fn()
    const data = ['Уляна тест 3']

    const { rerender } = render(
      <MantineProvider>
        <SearchableSelect
          data={data}
          label="Контрагент"
          value=""
          onChange={handleChange}
          onOptionSubmit={handleOptionSubmit}
        />
      </MantineProvider>,
    )

    const select = screen.getByRole('combobox', { name: 'Контрагент' })
    fireEvent.change(select, { target: { value: 'Уляна тест 3' } })

    rerender(
      <MantineProvider>
        <SearchableSelect
          data={data}
          label="Контрагент"
          value="Уляна тест 3"
          onChange={handleChange}
          onOptionSubmit={handleOptionSubmit}
        />
      </MantineProvider>,
    )

    fireEvent.click(select)
    fireEvent.click(screen.getByRole('option', { name: 'Уляна тест 3' }))

    expect(handleOptionSubmit).toHaveBeenCalledWith('Уляна тест 3')
  })
})
