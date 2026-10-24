import { useEffect } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../../clients/types'
import { useWizardClientCarousel } from './useWizardClientCarousel'
import { useWizardClientKeyboard } from './useWizardClientKeyboard'
import { dispatchWizardKey, getWizardKeyboardState, initializeWizardKeyboard, resetWizardKeyboard, setWizardKeyboardState } from './wizardKeyboard'

const clients: Client[] = [1, 2, 3, 4].map((id) => ({ Id: id, NetUid: `client-${id}`, FullName: `Client ${id}`, IsActive: true }))
const mocks = { confirm: vi.fn(), unselect: vi.fn(), loadMore: vi.fn(async () => {}), next: vi.fn(), previous: vi.fn(),
  query: vi.fn(), clear: vi.fn(), close: vi.fn() }
function Harness({ overlay = false, onClose = mocks.close }: { overlay?: boolean; onClose?: () => void }) {
  const navigation = useWizardClientCarousel({ confirmClient: mocks.confirm, unselectClient: mocks.unselect, loadMore: mocks.loadMore })
  const { applySearchResults, carousel, pickClient, searchInputRef } = navigation
  useEffect(() => applySearchResults(clients), [applySearchResults])
  const { keyboardState, handleSearchChange } = useWizardClientKeyboard({ navigation, hasOpenOverlay: overlay,
    selectNextAgreement: mocks.next, selectPreviousAgreement: mocks.previous, unselectClient: mocks.unselect,
    handleQueryChange: mocks.query, setQuery: mocks.clear, onRequestClose: onClose })
  return (
    <div onKeyDown={dispatchWizardKey}>
      <div className="new-sale-client-drum">
        <input aria-label="Client search" ref={searchInputRef} onChange={(event) => handleSearchChange(event.currentTarget.value)} />
        <button onClick={() => pickClient(clients[0])}>Pick client</button>
        <output data-testid="selection">{carousel.selected?.NetUid}</output>
      </div>
      <output data-testid="mode">{keyboardState}</output>
      <input aria-label="Register filter" />
      <textarea aria-label="Comment" />
      <button data-wizard-keyboard-help aria-expanded="true">Keyboard help</button>
    </div>
  )
}
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); resetWizardKeyboard() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('client keyboard navigation', () => {
  it('handles a physical key once and uses the current position for rapid Arrow/Enter presses', () => {
    const ui = render(<Harness />)
    const input = ui.getByLabelText('Client search')
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(ui.getByTestId('selection').textContent).toBe('client-4')
    expect(mocks.confirm.mock.calls).toEqual([[clients[2], { debounceDetails: true }], [clients[3], { debounceDetails: true }], [clients[3]]])
  })

  it.each([false, true])('blocks both capture and React dispatch while an overlay is open (detached=%s)', (detached) => {
    const container = detached ? document.createElement('div') : undefined
    const ui = render(<Harness overlay />, { container })
    const input = ui.getByLabelText('Client search')
    for (const key of ['ArrowDown', 'ArrowRight', 'Enter', 'Escape']) fireEvent.keyDown(input, { key })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.next).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
    expect(getWizardKeyboardState(0)).toBe('ClientSearch')
  })

  it('applies the same navigation and agreement rules when only React dispatch receives the event', () => {
    const ui = render(<Harness />, { container: document.createElement('div') })
    const input = ui.getByLabelText('Client search')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(mocks.next).toHaveBeenCalledOnce()
    expect(mocks.previous).toHaveBeenCalledOnce()
    expect(getWizardKeyboardState(0)).toBe('ClientAgreementSelection')
  })

  it('leaves editable registry fields and the help popup in control of their own keys', () => {
    const ui = render(<Harness />)
    act(() => setWizardKeyboardState('ClientSelection'))
    for (const target of [ui.getByLabelText('Register filter'), ui.getByLabelText('Comment'), ui.getByText('Keyboard help')]) {
      for (const key of ['ArrowDown', 'ArrowRight', 'Enter']) {
        expect(fireEvent.keyDown(target, { key })).toBe(true)
      }
    }
    expect(fireEvent.keyDown(ui.getByText('Keyboard help'), { key: 'Escape' })).toBe(true)
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.next).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('does not intercept Enter on a clickable row, but confirms from the body after focus is lost', () => {
    const ui = render(<Harness />)
    fireEvent.keyDown(ui.getByLabelText('Client search'), { key: 'ArrowDown' })
    mocks.confirm.mockClear()
    expect(fireEvent.keyDown(ui.getByText('Pick client'), { key: 'Enter' })).toBe(true)
    expect(mocks.confirm).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(mocks.confirm).toHaveBeenCalledWith(clients[2])
  })

  it('allows held arrows, suppresses repeated Enter/Escape, and ignores composition and modifier shortcuts', () => {
    const ui = render(<Harness />)
    const input = ui.getByLabelText('Client search')
    fireEvent.keyDown(input, { key: 'ArrowDown', repeat: true })
    expect(mocks.confirm).toHaveBeenCalledOnce()
    mocks.confirm.mockClear()
    for (const event of [{ key: 'Enter', repeat: true }, { key: 'ArrowDown', isComposing: true },
      { key: 'ArrowDown', keyCode: 229 }, { key: 'ArrowDown', ctrlKey: true }, { key: 'Enter', metaKey: true },
      { key: 'ArrowLeft', altKey: true }]) fireEvent.keyDown(input, event)
    expect(mocks.confirm).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.keyDown(input, { key: 'Escape', repeat: true })
    expect(getWizardKeyboardState(0)).toBe('ClientSearch')
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('steps Escape through agreement, client and search modes using fresh state, then closes', () => {
    const ui = render(<Harness />)
    act(() => setWizardKeyboardState('ClientAgreementSelection'))
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(getWizardKeyboardState(0)).toBe('ClientSearch')
    expect(mocks.clear).toHaveBeenCalledWith('')
    act(() => vi.runAllTimers())
    expect(document.activeElement).toBe(ui.getByLabelText('Client search'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('forwards new text immediately and prevents selecting results from the previous search', () => {
    const ui = render(<Harness />)
    const input = ui.getByLabelText('Client search')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    mocks.confirm.mockClear()
    fireEvent.change(input, { target: { value: 'new client' } })
    expect(mocks.query).toHaveBeenCalledWith('new client')
    expect(mocks.unselect).toHaveBeenCalledOnce()
    expect(ui.getByTestId('selection').textContent).toBe('')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('cancels pending focus restoration when a drawer opens and removes listeners on unmount', () => {
    const ui = render(<Harness />)
    fireEvent.click(ui.getByText('Pick client'))
    const filter = ui.getByLabelText('Register filter')
    filter.focus()
    ui.rerender(<Harness overlay />)
    act(() => vi.runAllTimers())
    expect(document.activeElement).toBe(filter)
    ui.unmount()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('uses the latest close callback and ignores events when another step is active', () => {
    const ui = render(<Harness />)
    const close = vi.fn()
    ui.rerender(<Harness onClose={close} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
    expect(mocks.close).not.toHaveBeenCalled()
    act(() => { initializeWizardKeyboard(1); fireEvent.keyDown(document.body, { key: 'ArrowDown' }) })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
})
