import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  TableRowAction,
  type TableRowActionKind,
  type TableRowActionTone,
} from './TableRowAction'

function renderAction(action: ReactNode) {
  return render(<MantineProvider>{action}</MantineProvider>)
}

const semanticActions: Array<[
  action: TableRowActionKind,
  iconClass: string,
  tone: TableRowActionTone,
]> = [
  ['add', 'plus', 'brand'],
  ['approve', 'thumbs-up', 'success'],
  ['archive', 'archive', 'neutral'],
  ['assign', 'user-plus', 'brand'],
  ['cancel', 'x', 'danger'],
  ['collapse', 'chevron-down', 'neutral'],
  ['complete', 'circle-check', 'success'],
  ['confirm', 'check', 'success'],
  ['copy', 'copy', 'neutral'],
  ['delete', 'trash-2', 'danger'],
  ['delivery', 'truck', 'neutral'],
  ['details', 'eye', 'neutral'],
  ['discount', 'percent', 'neutral'],
  ['document', 'file-text', 'neutral'],
  ['download', 'download', 'neutral'],
  ['edit', 'pencil', 'neutral'],
  ['expand', 'chevron-right', 'neutral'],
  ['history', 'history', 'neutral'],
  ['location', 'map-pin', 'neutral'],
  ['more', 'ellipsis-vertical', 'neutral'],
  ['move-down', 'arrow-down', 'neutral'],
  ['move-up', 'arrow-up', 'neutral'],
  ['open', 'external-link', 'neutral'],
  ['payment', 'banknote', 'neutral'],
  ['placement', 'between-vertical-end', 'neutral'],
  ['print', 'printer', 'neutral'],
  ['receipt', 'receipt', 'neutral'],
  ['recommend', 'sparkles', 'brand'],
  ['reassign', 'share-2', 'neutral'],
  ['reject', 'thumbs-down', 'danger'],
  ['restore', 'rotate-ccw', 'success'],
  ['route', 'route', 'neutral'],
  ['save', 'save', 'success'],
  ['select', 'check', 'success'],
  ['set-primary', 'star', 'neutral'],
  ['settings', 'settings', 'neutral'],
  ['status', 'list-tree', 'neutral'],
  ['transfer', 'arrow-left-right', 'neutral'],
  ['upload', 'upload', 'brand'],
  ['view', 'eye', 'neutral'],
  ['will-not-ship', 'triangle-alert', 'danger'],
]

describe('TableRowAction', () => {
  it('uses the shared edit icon and stops row click propagation', () => {
    const onAction = vi.fn()
    const onRow = vi.fn()

    renderAction(
      <div onClick={onRow}>
        <TableRowAction action="edit" label="Редагувати" onClick={onAction} />
      </div>,
    )

    const button = screen.getByRole('button', { name: 'Редагувати' })
    fireEvent.click(button)

    expect(onAction).toHaveBeenCalledOnce()
    expect(onRow).not.toHaveBeenCalled()
    expect(button.getAttribute('data-table-row-action')).toBe('edit')
    expect(button.classList.contains('is-neutral')).toBe(true)
    expect(button.querySelector('.lucide-pencil')).not.toBeNull()
  })

  it.each(semanticActions)('maps %s to one canonical glyph and tone', (action, iconClass, tone) => {
    renderAction(<TableRowAction action={action} label={action} />)

    const button = screen.getByRole('button', { name: action })
    expect(button.classList.contains(`is-${tone}`)).toBe(true)
    expect(button.querySelector(`.lucide-${iconClass}`)).not.toBeNull()
  })

  it('keeps document links on the same row-action pattern', () => {
    const ref = createRef<HTMLAnchorElement>()

    renderAction(
      <TableRowAction
        ref={ref}
        action="document"
        component="a"
        href="/documents/invoice.pdf"
        label="Відкрити документ"
        rel="noreferrer"
        target="_blank"
      />,
    )

    const link = screen.getByRole('link', { name: 'Відкрити документ' })
    expect(link.getAttribute('href')).toBe('/documents/invoice.pdf')
    expect(link.hasAttribute('type')).toBe(false)
    expect(link.getAttribute('data-table-row-action')).toBe('document')
    expect(link.querySelector('.lucide-file-text')).not.toBeNull()
    expect(ref.current).toBe(link)
  })

  it('blocks disabled and loading links without leaking button-only attributes', () => {
    const onAction = vi.fn()
    const onRow = vi.fn()
    const { rerender } = renderAction(
      <div onClick={onRow}>
        <TableRowAction
          action="download"
          component="a"
          disabled
          href="/documents/export.xlsx"
          label="Завантажити"
          onClick={onAction}
        />
      </div>,
    )

    const disabledLink = screen.getByRole('link', { name: 'Завантажити' })
    expect(fireEvent.click(disabledLink)).toBe(false)
    expect(disabledLink.getAttribute('aria-disabled')).toBe('true')
    expect(disabledLink.getAttribute('tabindex')).toBe('-1')
    expect(disabledLink.hasAttribute('disabled')).toBe(false)
    expect(disabledLink.hasAttribute('type')).toBe(false)
    expect(onAction).not.toHaveBeenCalled()
    expect(onRow).not.toHaveBeenCalled()

    rerender(
      <MantineProvider>
        <TableRowAction
          action="download"
          component="a"
          href="/documents/export.xlsx"
          label="Завантажити"
          loading
          onClick={onAction}
        />
      </MantineProvider>,
    )

    const loadingLink = screen.getByRole('link', { name: 'Завантажити' })
    expect(fireEvent.click(loadingLink)).toBe(false)
    expect(loadingLink.getAttribute('aria-busy')).toBe('true')
    expect(loadingLink.hasAttribute('disabled')).toBe(false)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('can intentionally bubble and forwards native button props and refs', () => {
    const onAction = vi.fn()
    const onRow = vi.fn()
    const ref = createRef<HTMLButtonElement>()

    renderAction(
      <div onClick={onRow}>
        <TableRowAction
          ref={ref}
          action="settings"
          data-testid="settings-action"
          hint="Зміна недоступна"
          label="Налаштування"
          stopPropagation={false}
          onClick={onAction}
        />
      </div>,
    )

    const button = screen.getByTestId('settings-action')
    fireEvent.click(button)

    expect(ref.current).toBe(button)
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('title')).toBe('Зміна недоступна')
    expect(onAction).toHaveBeenCalledOnce()
    expect(onRow).toHaveBeenCalledOnce()
  })
})
