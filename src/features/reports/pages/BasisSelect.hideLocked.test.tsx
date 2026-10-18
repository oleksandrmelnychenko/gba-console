import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { DayOrganizationBasisSelect } from './DayOrganizationBasisSelect'
import { SupplierBasisSelect } from './SupplierBasisSelect'

type BasisProps = { capability: unknown; value: unknown; disabled: boolean; hideLocked?: boolean; onChange: (value: 0 | 1) => void }

describe.each([
  ['Розрахунок валового прибутку', DayOrganizationBasisSelect, profitDayDataset.dayOrganizationBasis, null],
  ['Розрахунок за постачальниками', SupplierBasisSelect, profitSupplierDataset.supplierBasis, /^Невизначені постачальник або склад/],
] as const)('%s', (label, Basis: ComponentType<BasisProps>, capability, note) => {
  function show(disabled: boolean, hideLocked?: boolean) {
    render(<MantineProvider env="test"><I18nProvider>
      <Basis capability={capability} value={0} disabled={disabled} hideLocked={hideLocked} onChange={vi.fn()} />
    </I18nProvider></MantineProvider>)
    return screen.queryByRole('combobox', { name: label }) as HTMLInputElement | null
  }

  it('hides the locked one-value calculation under the BUG-1274 surface', () => {
    expect(show(true, true)).toBeNull()
    if (note) expect(screen.getByText(note)).toBeTruthy()
  })

  it('keeps the locked calculation visible and disabled outside the BUG-1274 surface', () => {
    expect(show(true)?.disabled).toBe(true)
  })

  it('keeps an unlocked calculation selectable under the BUG-1274 surface', () => {
    expect(show(false, true)?.disabled).toBe(false)
  })
})
