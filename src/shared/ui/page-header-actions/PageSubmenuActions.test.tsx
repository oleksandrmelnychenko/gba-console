import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PageHeaderActionsProvider, PageSubmenuActions, PageSubmenuActionsSlot } from './PageHeaderActions'

it('keeps page actions in the submenu and removes them on navigation', () => {
  const open = vi.fn()
  const shell = (reports: boolean) => <PageHeaderActionsProvider>
    <nav aria-label="Підменю"><PageSubmenuActionsSlot /></nav>
    <main>{reports ? <PageSubmenuActions><button onClick={open}>Шаблони</button></PageSubmenuActions> : <p>Товари</p>}</main>
  </PageHeaderActionsProvider>
  const view = render(shell(true))
  expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull()
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Шаблони' }))
  expect(open).toHaveBeenCalledOnce()
  view.rerender(shell(false))
  expect(screen.queryByRole('button', { name: 'Шаблони' })).toBeNull()
})
