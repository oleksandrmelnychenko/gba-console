import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { ChangeQtyModal } from './ChangeQtyModal'
import { ShiftOrderItemModal } from './ShiftOrderItemModal'
import { WizardConfirmModal } from './WizardConfirmModal'
import { CartRowActionsModal } from './CartRowActionsModal'

afterEach(cleanup)
function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider><I18nProvider>{children}</I18nProvider></MantineProvider>
}

describe('cart modal keyboard and dismissal', () => {
  it.each(['quantity', 'shift', 'delete'] as const)('Enter on Cancel cancels %s without confirming', async (kind) => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    const ui = render(kind === 'quantity'
      ? <ChangeQtyModal opened availableQty={10} initialQty={2} onAccept={onConfirm} onCancel={onCancel} />
      : kind === 'shift'
        ? <ShiftOrderItemModal opened amount={10} analyst="Test" regionCode="Київ" sourceName="Sale" onApply={onConfirm} onCancel={onCancel} />
        : <WizardConfirmModal opened message="Delete?" onConfirm={onConfirm} onCancel={onCancel} />, { wrapper })
    await waitFor(() => expect(ui.getByRole('dialog').contains(document.activeElement)).toBe(true))
    ui.getByRole('button', { name: 'Скасувати' }).focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('validates quantity on Enter, ignores repeats/composition/modifiers, and prevents bubbling', async () => {
    const onAccept = vi.fn(), onCancel = vi.fn(), onKeyDown = vi.fn()
    const ui = render(<div onKeyDown={onKeyDown}><ChangeQtyModal opened availableQty={10} onAccept={onAccept} onCancel={onCancel} /></div>, { wrapper })
    const input = ui.getByLabelText('Кількість')
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(ui.getByText('Невірна кількість')).toBeTruthy()
    fireEvent.change(input, { target: { value: '2.125' } })
    for (const extra of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      fireEvent.keyDown(input, { key: 'Enter', ...extra })
      fireEvent.keyDown(input, { key: 'Escape', ...extra })
    }
    expect(onAccept).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onKeyDown).not.toHaveBeenCalled()
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(onAccept).toHaveBeenCalledExactlyOnceWith(2.125, '')
  })

  it.each(['quantity', 'shift', 'delete'] as const)('blocks every close control while %s is busy', (kind) => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    const ui = render(kindModal(), { wrapper })
    function kindModal() {
      if (kind === 'quantity') return <ChangeQtyModal opened busy availableQty={10} initialQty={2} onAccept={onConfirm} onCancel={onCancel} />
      if (kind === 'shift') return <ShiftOrderItemModal opened busy amount={10} analyst="Test" regionCode="Київ" sourceName="Sale" onApply={onConfirm} onCancel={onCancel} />
      return <WizardConfirmModal opened busy message="Delete?" onConfirm={onConfirm} onCancel={onCancel} />
    }
    fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Escape' })
    fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Enter' })
    fireEvent.click(ui.getByRole('button', { name: 'Скасувати' }))
    fireEvent.click(ui.getByRole('button', { name: 'Закрити' }))
    const overlay = document.querySelector('.mantine-Modal-overlay')
    if (overlay) fireEvent.click(overlay)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('initially focuses confirmation and accepts Enter once', async () => {
    const onConfirm = vi.fn()
    const ui = render(<WizardConfirmModal opened message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />, { wrapper })
    const confirm = ui.getByRole('button', { name: 'Так' })
    await waitFor(() => expect(document.activeElement).toBe(confirm))
    fireEvent.keyDown(confirm, { key: 'Enter', repeat: true })
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.setup().keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('Escape cancels only once, including when the header has focus', () => {
    const onCancel = vi.fn()
    const ui = render(<WizardConfirmModal opened message="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />, { wrapper })
    fireEvent.keyDown(ui.getByRole('button', { name: 'Закрити' }), { key: 'Escape' })
    fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('moves a fractional quantity and resets it when switching source rows', async () => {
    const onApply = vi.fn()
    const props = { opened: true, amount: 5, analyst: 'Test', regionCode: 'Київ', sourceName: 'Sale', onApply, onCancel: vi.fn() }
    const ui = render(<ShiftOrderItemModal {...props} sessionKey="a" />, { wrapper })
    fireEvent.change(ui.getByLabelText('Кількість для переміщення'), { target: { value: '1.125' } })
    await act(async () => { fireEvent.keyDown(ui.getByLabelText('Кількість для переміщення'), { key: 'Enter' }) })
    expect(onApply).toHaveBeenCalledExactlyOnceWith(1.125)
    ui.rerender(<ShiftOrderItemModal {...props} sessionKey="b" />)
    expect((ui.getByLabelText('Кількість для переміщення') as HTMLInputElement).value).toBe('')
  })

  it('keeps invoice actions separate from editable cart rows', () => {
    const item = { NetUid: 'row-a', Product: { Name: 'Product' } }
    const props = { item, isInvoice: false, onChangeQty: vi.fn(), onRemove: vi.fn(), onActEdit: vi.fn(), onClose: vi.fn() }
    const ui = render(<CartRowActionsModal {...props} />, { wrapper })
    fireEvent.click(ui.getByRole('button', { name: 'Змінити кількість' }))
    expect(props.onChangeQty).toHaveBeenCalledWith(item)
    fireEvent.click(ui.getByRole('button', { name: 'Видалити' }))
    expect(props.onRemove).toHaveBeenCalledWith(item)
    ui.rerender(<CartRowActionsModal {...props} isInvoice />)
    expect(ui.queryByRole('button', { name: 'Змінити кількість' })).toBeNull()
    expect(ui.queryByRole('button', { name: 'Видалити' })).toBeNull()
    fireEvent.click(ui.getByRole('button', { name: 'Акт редагування накладної' }))
    expect(props.onActEdit).toHaveBeenCalledOnce()
  })
})
