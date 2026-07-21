import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { CHECKBOX_MULTI_SELECT_WIDTH, CheckboxMultiSelect } from './CheckboxMultiSelect'

const options = [
  { value: 'first', label: 'Перший склад' },
  { value: 'second', label: 'Другий склад' },
]

function renderControl(value: string[]) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <CheckboxMultiSelect
          data={options}
          label="Склади"
          placeholder="Оберіть склади"
          value={value}
          onChange={() => undefined}
        />
      </I18nProvider>
    </MantineProvider>,
  )
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
})
