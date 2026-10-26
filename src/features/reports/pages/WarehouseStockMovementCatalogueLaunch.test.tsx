import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WAREHOUSE_MONETARY_SOURCE } from '../data/originalWarehouseMonetary'
import { migrationFixture } from '../data/reportMigration.test-fixtures'
import type { ReportCatalogueEntry } from '../types'
import { WarehouseStockMovementCatalogueLaunch } from './WarehouseStockMovementCatalogueLaunch'

const report: ReportCatalogueEntry = { Id: 'builtin:ВедомостьПартииТоваровНаСкладах', Name: 'ВедомостьПартииТоваровНаСкладах', Title: 'Відомість партій', Kind: 'builtin',
  Sources: [{ World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE, Attributes: [], DefinitionSha256: 'a'.repeat(64), Migration: migrationFixture('native_partial') }] }
const mount = (props: Partial<Parameters<typeof WarehouseStockMovementCatalogueLaunch>[0]> = {}) => {
  const onOpen = vi.fn(() => true)
  render(<MantineProvider env="test"><WarehouseStockMovementCatalogueLaunch report={report} worlds={['fenix', 'amg']} enabled disabled={false} callerKey="owner" onOpen={onOpen} {...props} /></MantineProvider>)
  return onOpen
}

describe('native stock movement catalogue launch', () => {
  it('opens the native report from the 1C batch-statement entry without loading 1C captures', () => {
    const onOpen = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару — залишки, прихід і розхід' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it.each([
    ['another report', { report: { ...report, Id: 'builtin:ВаловаяПрибыль' } }],
    ['AMG-only filter', { worlds: ['amg'] }],
    ['missing permission', { enabled: false }],
    ['missing caller', { callerKey: null }],
  ] as const)('stays hidden for %s', (_, props) => {
    mount(props)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not open while the page is busy', () => {
    const onOpen = mount({ disabled: true })
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару — залишки, прихід і розхід' }))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
