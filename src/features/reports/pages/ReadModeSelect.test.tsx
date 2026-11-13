import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { profitReadModeCapability } from '../data/profitReadMode.test-fixtures'
import { cashReadModeCapability } from '../data/cashReadMode.test-fixtures'
import { settlementReadModeCapability } from '../data/settlementReadMode.test-fixtures'
import { ProfitReadModeSelect } from './ProfitReadModeSelect'
import { CashReadModeSelect } from './CashReadModeSelect'
import { SettlementReadModeSelect } from './SettlementReadModeSelect'

type SelectProps = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1 | undefined) => void }

describe.each([
  ['profit', ProfitReadModeSelect, profitReadModeCapability, /^Продажі та повернення з документів GBA/],
] as const)('%s calculation source', (_, Select: ComponentType<SelectProps>, capability, currentNote) => {
  function show(value: unknown) {
    const onChange = vi.fn()
    render(<MantineProvider env="test"><I18nProvider>
      <Select capability={capability} value={value} disabled={false} onChange={onChange} />
    </I18nProvider></MantineProvider>)
    return onChange
  }
  function mount(value: unknown) {
    const onChange = show(value)
    const select = screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement
    fireEvent.click(select)
    return { onChange, select }
  }

  it('hides the single current GBA documents source under the BUG-1274 surface and its technical explanation', () => {
    show(0)
    expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
    expect(screen.queryByText(currentNote)).toBeNull()
  })

  it('keeps a request without a source visible but not selectable again', () => {
    const { onChange, select } = mount(undefined)
    expect(select.value).toBe('За налаштуваннями звіту')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Поточні документи GBA', 'За налаштуваннями звіту'])
    expect(screen.getByRole('option', { name: 'За налаштуваннями звіту' }).hasAttribute('data-combobox-disabled')).toBe(true)
    fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('keeps an already selected 1C register source visible but not selectable again', () => {
    const { onChange, select } = mount(1)
    expect(select.value).toBe('Збережені регістри 1С')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Поточні документи GBA', 'Збережені регістри 1С'])
    const register = screen.getByRole('option', { name: 'Збережені регістри 1С' })
    expect(register.hasAttribute('data-combobox-disabled')).toBe(true)
    fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})

describe.each([
  ['cash', CashReadModeSelect, cashReadModeCapability, /^Документи GBA .* банківських рахунків і кас/],
  ['settlement', SettlementReadModeSelect, settlementReadModeCapability, /^Документи GBA .* контрагентів групи «Покупці»/],
] as const)('%s calculation source', (_, Select: ComponentType<SelectProps>, capability, currentNote) => {
  function show(value: unknown) {
    const onChange = vi.fn()
    render(<MantineProvider env="test"><I18nProvider>
      <Select capability={capability} value={value} disabled={false} onChange={onChange} />
    </I18nProvider></MantineProvider>)
    return onChange
  }

  it('hides the single current GBA documents source under the BUG-1274 surface', () => {
    show(0)
    expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
    expect(screen.queryByText(currentNote)).toBeNull()
  })

  it.each([undefined, 1])('lets a request with the retired source %s switch to current GBA documents', (value) => {
    const onChange = show(value)
    const select = screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement
    expect(select.value).toBe('')
    fireEvent.click(select)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Поточні документи GBA'])
    fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
