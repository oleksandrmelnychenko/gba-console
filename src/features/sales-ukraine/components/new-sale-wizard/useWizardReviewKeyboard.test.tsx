import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardReviewKeyboard } from './useWizardReviewKeyboard'
import { WizardReviewCombobox } from './WizardReviewCombobox'
import { WizardReviewConfirmModal } from './WizardReviewConfirmModal'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { dispatchWizardKey, resetWizardKeyboard } from './wizardKeyboard'

type Options = Parameters<typeof useWizardReviewKeyboard>[0]
function options(): Options {
  return { contextKey: 'sale-a', busy: false, finalSubmitOutcomePending: false,
    submitSale: vi.fn(async () => {}), submitFromKeyboard: vi.fn(), saveSale: vi.fn(async () => true),
    onClose: vi.fn(), onRequestClose: vi.fn(), onRegisterSubmit: vi.fn() }
}
function Harness({ options: props }: { options: Options }) {
  const { submitRef, confirmOpened, handleConfirmClose, handleCancelClose } = useWizardReviewKeyboard(props)
  return <div onKeyDown={dispatchWizardKey} data-testid="root" tabIndex={-1}>
    <input aria-label="City" />
    <button ref={submitRef} onClick={props.submitSale}>Submit</button>
    <output data-testid="confirmation">{String(confirmOpened)}</output>
    {confirmOpened && <div>
      <button onClick={handleConfirmClose}>Confirm</button>
      <button onClick={handleCancelClose}>Cancel</button>
    </div>}
  </div>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}
beforeEach(resetWizardKeyboard)
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('review step keyboard', () => {
  it('keeps Enter in fields and native buttons separate from the wizard submit shortcut', async () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    expect(document.activeElement).toBe(ui.getByText('Submit'))
    const user = userEvent.setup()
    await user.keyboard('{Enter}')
    expect(props.submitSale).toHaveBeenCalledOnce()
    expect(props.submitFromKeyboard).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByLabelText('City'), { key: 'Enter' })
    expect(props.submitFromKeyboard).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Enter' })
    expect(props.submitFromKeyboard).toHaveBeenCalledOnce()
  })

  it('ignores repeats, composition, modifiers and busy submission', () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    for (const extra of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      fireEvent.keyDown(ui.getByTestId('root'), { key: 'Enter', ...extra })
      fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape', ...extra })
    }
    expect(props.submitFromKeyboard).not.toHaveBeenCalled()
    expect(ui.getByTestId('confirmation').textContent).toBe('false')
    ui.rerender(<Harness options={{ ...props, busy: true }} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Enter' })
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    expect(props.submitFromKeyboard).not.toHaveBeenCalled()
    expect(ui.getByTestId('confirmation').textContent).toBe('false')
  })

  it('opens confirmation once and does not submit the sale through a modal key', () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    fireEvent.keyDown(ui.getByText('Confirm'), { key: 'Enter' })
    expect(props.submitFromKeyboard).not.toHaveBeenCalled()
    fireEvent.click(ui.getByText('Confirm'))
    expect(props.saveSale).toHaveBeenCalledOnce()
  })

  it('waits for saving before closing and ignores duplicate confirmations', async () => {
    const pending = deferred<boolean>()
    const props = { ...options(), saveSale: vi.fn(() => pending.promise) }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    const button = ui.getByText('Confirm')
    act(() => { fireEvent.click(button); fireEvent.click(button) })
    expect(props.saveSale).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
    await act(async () => { pending.resolve(true) })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('does not close another sale after a previous save finishes or reopen an old A-B-A confirmation', async () => {
    const pending = deferred<boolean>()
    const props = { ...options(), saveSale: vi.fn(() => pending.promise) }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    ui.rerender(<Harness options={{ ...props, contextKey: 'sale-b' }} />)
    ui.rerender(<Harness options={props} />)
    expect(ui.getByTestId('confirmation').textContent).toBe('false')
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    fireEvent.click(ui.getByText('Confirm'))
    ui.rerender(<Harness options={{ ...props, contextKey: 'sale-b' }} />)
    await act(async () => { pending.resolve(true) })
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('retains the pending-outcome exit route without attempting to save again', () => {
    const props = { ...options(), finalSubmitOutcomePending: true }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    expect(props.onRequestClose).toHaveBeenCalledOnce()
    expect(props.saveSale).not.toHaveBeenCalled()
    expect(ui.getByTestId('confirmation').textContent).toBe('false')
  })

  it('restores focus after cancel and cancels scheduled focus on unmount', () => {
    vi.useFakeTimers()
    const props = options()
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    fireEvent.click(ui.getByText('Cancel'))
    act(() => vi.runAllTimers())
    expect(document.activeElement).toBe(ui.getByText('Submit'))
    fireEvent.keyDown(ui.getByTestId('root'), { key: 'Escape' })
    fireEvent.click(ui.getByText('Cancel'))
    const focus = vi.spyOn(ui.getByText('Submit'), 'focus')
    ui.unmount()
    act(() => vi.runAllTimers())
    expect(focus).not.toHaveBeenCalled()
  })

  it('registers one stable submit callback that always uses the latest operation', async () => {
    const props = options()
    const { rerender, unmount } = renderHook(useWizardReviewKeyboard, { initialProps: props })
    const register = vi.mocked(props.onRegisterSubmit!)
    const callback = register.mock.calls[0][0]!
    const submit = vi.fn(async () => {})
    rerender({ ...props, submitSale: submit })
    await callback()
    expect(register).toHaveBeenCalledOnce()
    expect(submit).toHaveBeenCalledOnce()
    expect(props.submitSale).not.toHaveBeenCalled()
    unmount()
    expect(register).toHaveBeenLastCalledWith(null)
  })
})

describe('review form native keyboard behavior', () => {
  it('Tabs through carrier, recipient and address, committing free text on Tab', async () => {
    const user = userEvent.setup()
    const createRecipient = vi.fn()
    const createAddress = vi.fn()
    const ui = render(<MantineProvider>
      <WizardReviewCombobox label="Carrier" options={[]} selectedKey={null} onSelect={() => {}} />
      <WizardReviewCombobox allowFreeForm label="Recipient" options={[]} selectedKey={null} onSelect={() => {}} onFreeText={createRecipient} />
      <WizardReviewCombobox allowFreeForm label="Address" options={[]} selectedKey={null} onSelect={() => {}} onFreeText={createAddress} />
      <button>Submit</button>
    </MantineProvider>)
    await user.tab()
    expect(document.activeElement).toBe(ui.getByLabelText('Carrier'))
    await user.tab()
    expect(document.activeElement).toBe(ui.getByLabelText('Recipient'))
    await user.type(ui.getByLabelText('Recipient'), 'Recipient name')
    await user.tab()
    expect(createRecipient).toHaveBeenCalledExactlyOnceWith('Recipient name')
    expect(document.activeElement).toBe(ui.getByLabelText('Address'))
    await user.type(ui.getByLabelText('Address'), 'Address text')
    await user.tab()
    expect(createAddress).toHaveBeenCalledExactlyOnceWith('Address text')
    expect(document.activeElement).toBe(ui.getByText('Submit'))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(ui.getByLabelText('Address'))
  })

  it('Enter on the confirmation Cancel button cancels, and held Enter does not confirm', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn()
    const cancel = vi.fn()
    const ui = render(<MantineProvider><I18nProvider>
      <WizardReviewConfirmModal opened onCancel={cancel} onConfirm={confirm} />
    </I18nProvider></MantineProvider>)
    const confirmButton = ui.getByRole('button', { name: 'Так' })
    await waitFor(() => expect(document.activeElement).toBe(confirmButton))
    const cancelButton = ui.getByRole('button', { name: 'Скасувати' })
    cancelButton.focus()
    await user.keyboard('{Enter}')
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.keyDown(confirmButton, { key: 'Enter', repeat: true })
    expect(confirm).not.toHaveBeenCalled()
    confirmButton.focus()
    await user.keyboard('{Enter}')
    expect(confirm).toHaveBeenCalledOnce()
  })
})
