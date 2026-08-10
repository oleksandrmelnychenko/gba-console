import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { CHECKBOX_MULTI_SELECT_WIDTH, CheckboxMultiSelect } from './CheckboxMultiSelect'

const options = [
  { value: 'first', label: 'Перший склад' },
  { value: 'second', label: 'Другий склад' },
]

function renderControl(value: string[], onChange: (value: string[]) => void = () => undefined) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <CheckboxMultiSelect
          data={options}
          label="Склади"
          placeholder="Оберіть склади"
          value={value}
          onChange={onChange}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

function openDropdown() {
  fireEvent.click(screen.getByRole('button'))
}

describe('CheckboxMultiSelect', () => {
  it('uses the shared fixed width and shows the placeholder with no selection', () => {
    renderControl([])

    const control = document.querySelector('.checkbox-multi-select')

    expect(CHECKBOX_MULTI_SELECT_WIDTH).toBe('var(--app-multi-select-width, 240px)')
    expect(control).toBeTruthy()
    expect(control?.textContent).toContain('Оберіть склади')
  })

  it('shows the selected option label for a single selection', () => {
    renderControl(['first'])

    expect(document.querySelector('.checkbox-multi-select__summary')?.textContent).toBe('Перший склад')
  })

  it('shows only the selected count for multiple selections', () => {
    renderControl(['first', 'second'])

    expect(document.querySelector('.checkbox-multi-select__summary')?.textContent).toBe('Вибрано: 2')
  })

  it('does not duplicate a single real option with a coupled select-all checkbox', () => {
    const onChange = vi.fn()

    render(
      <MantineProvider>
        <I18nProvider>
          <CheckboxMultiSelect
            data={[{ value: 'may', label: 'MAY' }]}
            label="Групи товарів"
            value={['may']}
            onChange={onChange}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    openDropdown()

    expect(screen.getByRole('option', { name: 'MAY' })).not.toBeNull()
    expect(screen.queryByRole('option', { name: 'Всі' })).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: 'MAY' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('keeps select-all available when it controls multiple independent options', () => {
    const onChange = vi.fn()
    renderControl(['first', 'second'], onChange)

    openDropdown()

    expect(screen.getByRole('option', { name: 'Всі' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Перший склад' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Другий склад' })).not.toBeNull()

    fireEvent.click(screen.getByRole('option', { name: 'Перший склад' }))

    expect(onChange).toHaveBeenCalledWith(['second'])
  })
})
