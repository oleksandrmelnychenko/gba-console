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

type SelectProps = { capability: unknown; value: unknown; disabled: boolean; hideRegister?: boolean; onChange: (value: 0 | 1 | undefined) => void }

describe.each([
  ['profit', ProfitReadModeSelect, profitReadModeCapability],
  ['cash', CashReadModeSelect, cashReadModeCapability],
  ['settlement', SettlementReadModeSelect, settlementReadModeCapability],
] as const)('%s calculation source', (_, Select: ComponentType<SelectProps>, capability) => {
  function mount(value: unknown, hideRegister?: boolean) {
    const onChange = vi.fn()
    render(<MantineProvider env="test"><I18nProvider>
      <Select capability={capability} value={value} disabled={false} hideRegister={hideRegister} onChange={onChange} />
    </I18nProvider></MantineProvider>)
    const select = screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement
    fireEvent.click(select)
    return { onChange, select }
  }

  it('offers the 1C register source by default', () => {
    const { onChange } = mount(0)
    expect(screen.getAllByRole('option').map(option => option.textContent))
      .toEqual(['Поточні документи GBA', 'Збережені регістри 1С', 'За налаштуваннями звіту'])
    fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it.each([0, undefined])('hides the 1C register source for value %s', value => {
    mount(value, true)
    expect(screen.getAllByRole('option').map(option => option.textContent))
      .toEqual(['Поточні документи GBA', 'За налаштуваннями звіту'])
  })

  it('keeps an already selected 1C register source visible but not selectable again', () => {
    const { onChange, select } = mount(1, true)
    expect(select.value).toBe('Збережені регістри 1С')
    const register = screen.getByRole('option', { name: 'Збережені регістри 1С' })
    expect(register.hasAttribute('data-combobox-disabled')).toBe(true)
    fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
