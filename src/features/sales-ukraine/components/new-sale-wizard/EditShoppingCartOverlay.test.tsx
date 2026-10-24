import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { EditShoppingCartOverlay } from './EditShoppingCartOverlay'
import type { WizardSplitOrderItem } from './wizardSplitSale'
import type { DataTableProps } from '../../../../shared/ui/data-table/types'
import type { WizardCartEditRow } from './wizardCartEditModel'

const snapshots = vi.hoisted(() => new Map<string, DataTableProps<WizardCartEditRow>>())
vi.mock('../../../../shared/ui/data-table/DataTable', () => ({
  DataTable: (props: DataTableProps<WizardCartEditRow>) => {
    snapshots.set(props.tableId, props)
    return <div data-testid={props.tableId}>{props.data.map((row) => <div key={row.index}
      className={`data-table-row ${props.rowClassName?.(row) ?? ''}`}>
      {props.columns.map((column) => <span key={column.id}>{column.cell?.(row)}</span>)}
    </div>)}</div>
  },
}))
const scroll = vi.fn()
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll }))
afterAll(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})
beforeEach(() => snapshots.clear())
afterEach(() => { cleanup(); scroll.mockClear() })
function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
const splitItem: WizardSplitOrderItem = { Product: { NameUA: 'Split' }, Qty: 1, TotalAmount: 2, TotalAmountEurToUah: 80, TotalAmountLocal: 80 }
function props() {
  return { currentItems: [{ Product: { NameUA: 'First', VendorCode: 'A' }, Qty: 1 }, { Product: { NameUA: 'Second', VendorCode: 'A' }, Qty: 2 }],
    splitItems: [splitItem], isSplit: true, selected: { list: 'current' as const, index: 0 }, onClose: vi.fn() }
}

describe('cart edit overlay', () => {
  it('reuses rows and columns during navigation and updates only the changed source', () => {
    const initial = props()
    const ui = render(<EditShoppingCartOverlay {...initial} />, { wrapper })
    const current = snapshots.get('new-sale-cart-edit-current')!
    const split = snapshots.get('new-sale-cart-edit-split')!
    expect(ui.container.querySelector('.is-selected')?.textContent).toContain('First')
    ui.rerender(<EditShoppingCartOverlay {...initial} selected={{ list: 'current', index: 1 }} />)
    expect(snapshots.get('new-sale-cart-edit-current')!.data).toBe(current.data)
    expect(snapshots.get('new-sale-cart-edit-current')!.columns).toBe(current.columns)
    expect(snapshots.get('new-sale-cart-edit-split')).toBe(split)
    expect(ui.container.querySelector('.is-selected')?.textContent).toContain('Second')
    ui.rerender(<EditShoppingCartOverlay {...initial} currentItems={[...initial.currentItems]} selected={{ list: 'split', index: 0 }} />)
    expect(snapshots.get('new-sale-cart-edit-current')!.data).not.toBe(current.data)
    expect(snapshots.get('new-sale-cart-edit-split')!.data).toBe(split.data)
    expect(ui.container.querySelector('.is-selected')?.textContent).toContain('Split')
    expect(scroll).toHaveBeenCalledTimes(3)
  })

  it('hides split rows without losing them and disables closing while a mutation is pending', () => {
    const initial = props()
    const ui = render(<EditShoppingCartOverlay {...initial} busy />, { wrapper })
    fireEvent.click(ui.getByRole('button', { name: 'Закрити' }))
    expect(initial.onClose).not.toHaveBeenCalled()
    ui.rerender(<EditShoppingCartOverlay {...initial} isSplit={false} />)
    expect(ui.queryByTestId('new-sale-cart-edit-split')).toBeNull()
    fireEvent.click(ui.getByRole('button', { name: 'Закрити' }))
    expect(initial.onClose).toHaveBeenCalledOnce()
    ui.rerender(<EditShoppingCartOverlay {...initial} />)
    expect(ui.getByTestId('new-sale-cart-edit-split').textContent).toContain('Split')
  })
})
