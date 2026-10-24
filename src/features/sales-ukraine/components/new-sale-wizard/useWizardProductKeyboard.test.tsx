import { createRef } from 'react'
import { createPortal } from 'react-dom'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchWizardProductNavigation as dispatch, type WizardProductKeyboardContext } from './wizardProductKeyboard'
import { useWizardProductKeyboard } from './useWizardProductKeyboard'
import { dispatchWizardKey, initializeWizardKeyboard, resetWizardKeyboard, type WizardProductKeyboardState } from './wizardKeyboard'

function navigation(state: WizardProductKeyboardState = 'ProductSelection'): WizardProductKeyboardContext {
  const list = (netId: string) => ({ count: 6, index: 2, product: { NetUid: netId }, focus: vi.fn() })
  return {
    state, isMainActive: true,
    main: list('main'), analogue: { ...list('analogue'), parentNetUid: 'component', escape: vi.fn() }, component: list('component'),
    details: { chipCount: 7, chipIndex: 0, rowIndex: 0, rowsFor: vi.fn(() => [{ NetId: 'row-1' }, { NetId: 'row-2' }]),
      cycle: vi.fn(), navigate: vi.fn(), reset: vi.fn(), select: vi.fn(), shift: vi.fn() },
    cart: { hasSelection: true, open: vi.fn(), move: vi.fn(), edit: vi.fn(async () => {}),
      toggleSplit: vi.fn(), remove: vi.fn(), exit: vi.fn(async () => {}) },
    actions: { setState: vi.fn(), add: vi.fn(async () => {}), openMainDetail: vi.fn(() => true), openMainRelated: vi.fn(),
      clearSelection: vi.fn(), returnToMain: vi.fn(), openImage: vi.fn(), openInterest: vi.fn(), closeImage: vi.fn(),
      closeInterest: vi.fn(), toggleDescription: vi.fn(async () => {}), requestClose: vi.fn() },
  }
}
const modes = [
  ['ProductSelection', 'FullDetail', 'main'],
  ['AnalogueSelection', 'AnalogueFullDetail', 'analogue'],
  ['ComponentSelection', 'ComponentFullDetail', 'component'],
] as const
beforeEach(() => { resetWizardKeyboard(); initializeWizardKeyboard(1) })
afterEach(cleanup)

describe('product keyboard navigation policy', () => {
  it('enters search results around the split centre and handles empty results', () => {
    const ctx = navigation('ProductSearch')
    dispatch('ArrowDown', ctx)
    dispatch('ArrowUp', ctx)
    expect(ctx.main.focus).toHaveBeenNthCalledWith(1, 3)
    expect(ctx.main.focus).toHaveBeenNthCalledWith(2, 2)
    expect(ctx.actions.setState).toHaveBeenCalledWith('ProductSelection')
    ctx.main.count = 0
    dispatch('ArrowDown', ctx)
    expect(ctx.main.focus).toHaveBeenCalledTimes(2)
  })

  it('only adds a main active search result and preserves search close/detail commands', () => {
    const ctx = navigation('ProductSearch')
    ctx.isMainActive = false
    expect(dispatch('Enter', ctx)).toBe(false)
    ctx.isMainActive = true
    dispatch('Enter', ctx)
    expect(ctx.actions.add).toHaveBeenCalledWith(ctx.main.product)
    dispatch('CtrlEnter', ctx)
    dispatch('Escape', ctx)
    expect(ctx.actions.openMainDetail).toHaveBeenCalledOnce()
    expect(ctx.actions.requestClose).toHaveBeenCalledOnce()
  })

  it.each(modes)('navigates and adds the selected %s product', (selection, _detail, kind) => {
    const ctx = navigation(selection)
    dispatch('ArrowDown', ctx)
    dispatch('ArrowUp', ctx)
    expect(ctx[kind].focus).toHaveBeenNthCalledWith(1, 3)
    expect(ctx[kind].focus).toHaveBeenNthCalledWith(2, 1)
    dispatch('Enter', ctx)
    expect(ctx.actions.add).toHaveBeenCalledWith(ctx[kind].product)
    dispatch('CtrlEnter', ctx)
    if (kind === 'main') expect(ctx.actions.openMainDetail).toHaveBeenCalledOnce()
    else expect(ctx.actions.setState).toHaveBeenCalledWith(_detail)
  })

  it.each(modes)('navigates available rows and chips in %s detail', (_selection, detail, kind) => {
    const ctx = navigation(detail)
    dispatch('ArrowDown', ctx)
    dispatch('ArrowLeft', ctx)
    dispatch('ArrowRight', ctx)
    expect(ctx.details.rowsFor).toHaveBeenCalledWith(ctx[kind].product)
    expect(ctx.details.navigate).toHaveBeenCalledWith(1, 2)
    expect(ctx.details.cycle).toHaveBeenNthCalledWith(1, -1, 7)
    expect(ctx.details.cycle).toHaveBeenNthCalledWith(2, 1, 7)
    expect(ctx[kind].focus).not.toHaveBeenCalled()
  })

  it.each(modes)('retains the detail mode while moving through %s products without rows', (_selection, detail, kind) => {
    const ctx = navigation(detail)
    vi.mocked(ctx.details.rowsFor).mockReturnValue([])
    dispatch('ArrowUp', ctx)
    expect(ctx[kind].focus).toHaveBeenCalledWith(1, { keepDetail: true })
  })

  it('uses main non-invoice arrows for products and permits shifting only a main invoice row', () => {
    const ctx = navigation('FullDetail')
    ctx.details.chipIndex = 2
    dispatch('ArrowDown', ctx)
    dispatch('Ctrl', ctx)
    expect(ctx.main.focus).toHaveBeenCalledWith(3, { keepDetail: true })
    expect(ctx.details.navigate).not.toHaveBeenCalled()
    expect(ctx.details.shift).not.toHaveBeenCalled()
    ctx.details.chipIndex = 0
    dispatch('Ctrl', ctx)
    expect(ctx.details.shift).toHaveBeenCalledWith({ NetId: 'row-1' })
    ctx.state = 'AnalogueFullDetail'
    dispatch('Ctrl', ctx)
    ctx.state = 'ComponentFullDetail'
    dispatch('Ctrl', ctx)
    expect(ctx.details.shift).toHaveBeenCalledOnce()
  })

  it.each(modes)('resolves rows only for navigation, not add or image/interest actions in %s detail', (_selection, detail, kind) => {
    const ctx = navigation(detail)
    dispatch('Enter', ctx)
    dispatch('CtrlI', ctx)
    dispatch('CtrlB', ctx)
    expect(ctx.details.rowsFor).not.toHaveBeenCalled()
    expect(ctx.actions.add).toHaveBeenCalledWith(ctx[kind].product)
    expect(ctx.actions.openImage).toHaveBeenCalledWith(ctx[kind].product)
    expect(ctx.actions.openInterest).toHaveBeenCalledWith(ctx[kind].product)
  })

  it('preserves related-selection shortcut restrictions and validates analogue ownership on Space', () => {
    const ctx = navigation('ComponentSelection')
    dispatch('CtrlI', ctx)
    dispatch('CtrlB', ctx)
    expect(ctx.actions.openImage).not.toHaveBeenCalled()
    expect(ctx.actions.openInterest).not.toHaveBeenCalled()
    ctx.component.product = { NetUid: 'component', HasAnalogue: true }
    ctx.analogue.parentNetUid = 'old'
    dispatch('Space', ctx)
    expect(ctx.analogue.focus).not.toHaveBeenCalled()
    ctx.analogue.parentNetUid = 'component'
    dispatch('Space', ctx)
    expect(ctx.analogue.focus).toHaveBeenCalledWith(0)
    expect(ctx.actions.setState).toHaveBeenCalledWith('AnalogueSelection')
    ctx.state = 'ComponentFullDetail'
    dispatch('Space', ctx)
    expect(ctx.details.reset).toHaveBeenCalledOnce()
  })

  it('focuses the first related item on Space and delegates main relationships', () => {
    const ctx = navigation('AnalogueSelection')
    ctx.analogue.index = null
    dispatch('Space', ctx)
    expect(ctx.analogue.focus).toHaveBeenCalledWith(0)
    ctx.state = 'ComponentSelection'
    ctx.component.index = null
    dispatch('Space', ctx)
    expect(ctx.component.focus).toHaveBeenCalledWith(0)
    ctx.state = 'FullDetail'
    dispatch('Space', ctx)
    expect(ctx.actions.openMainRelated).toHaveBeenCalledOnce()
  })

  it.each(modes)('preserves the Escape hierarchy for %s', (selection, detail, kind) => {
    const ctx = navigation(detail)
    dispatch('Escape', ctx)
    if (kind !== 'main') {
      expect(ctx.details.select).toHaveBeenCalledWith({ chipIndex: null, rowIndex: null })
      expect(ctx.details.reset).not.toHaveBeenCalled()
      ctx.details.chipIndex = null
      dispatch('Escape', ctx)
    }
    expect(ctx.details.reset).toHaveBeenCalledOnce()
    expect(ctx.actions.setState).toHaveBeenCalledWith(selection)
    ctx.state = selection
    dispatch('Escape', ctx)
    expect(kind === 'main' ? ctx.actions.clearSelection : kind === 'analogue' ? ctx.analogue.escape : ctx.actions.returnToMain).toHaveBeenCalledOnce()
  })

  it('routes cart navigation, edit, split, delete and exit through the cart controller', () => {
    const ctx = navigation('EditShoppingCart')
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Space', 'Delete', 'Escape'] as const) expect(dispatch(key, ctx)).toBe(true)
    expect(ctx.cart.move).toHaveBeenNthCalledWith(1, 1)
    expect(ctx.cart.move).toHaveBeenNthCalledWith(2, -1)
    expect(ctx.cart.edit).toHaveBeenCalledOnce()
    expect(ctx.cart.toggleSplit).toHaveBeenCalledOnce()
    expect(ctx.cart.remove).toHaveBeenCalledOnce()
    expect(ctx.cart.exit).toHaveBeenCalledOnce()
    ctx.cart.hasSelection = false
    dispatch('Delete', ctx)
    expect(ctx.cart.remove).toHaveBeenCalledOnce()
    expect(dispatch('F2', ctx)).toBe(false)
  })

  it.each(['ViewImage', 'Interest'] as const)('closes %s before opening cart editing and consumes underlying navigation', (state) => {
    const ctx = navigation(state)
    dispatch('Enter', ctx)
    expect(ctx.actions.add).not.toHaveBeenCalled()
    dispatch('F2', ctx)
    expect(state === 'ViewImage' ? ctx.actions.closeImage : ctx.actions.closeInterest).toHaveBeenCalledOnce()
    expect(ctx.cart.open).toHaveBeenCalledOnce()
  })

  it('delegates description saving before opening cart editing on F2', () => {
    const ctx = navigation('EditProductDescription')
    dispatch('F2', ctx)
    expect(ctx.actions.toggleDescription).toHaveBeenCalledOnce()
    expect(ctx.cart.open).toHaveBeenCalledOnce()
  })
})

type Options = Parameters<typeof useWizardProductKeyboard>[0]
function options(): Options {
  return { navigation: navigation(), containerRef: createRef<HTMLDivElement>(), searchInputRef: createRef<HTMLInputElement>(),
    blockingOverlay: false, cartSheetOpen: false, crossSellOpen: false, productCardOpen: false,
    setCartSheetOpen: vi.fn(), closeProductDetails: vi.fn() }
}
function Harness({ options: props }: { options: Options }) {
  const { containerRef, searchInputRef } = props
  const { handleProductDetailsKeyDown } = useWizardProductKeyboard(props)
  return <div ref={containerRef} onKeyDown={dispatchWizardKey}>
    <input ref={searchInputRef} aria-label="Search" />
    <input aria-label="Filter" />
    <button>Action</button>
    <div className="new-sale-product-details-drawer" onKeyDown={handleProductDetailsKeyDown} data-testid="details">
      <input aria-label="Description" /><button>Save</button>
      {createPortal(<div className="mantine-Modal-content" data-testid="child"><input aria-label="Child field" /></div>, document.body)}
    </div>
  </div>
}

describe('product keyboard event ownership', () => {
  it('dispatches a key once from the step and also supports focus on the document body', () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByLabelText('Search'), { key: 'Enter' })
    expect(props.navigation.actions.add).toHaveBeenCalledOnce()
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(props.navigation.main.focus).toHaveBeenCalledOnce()
  })

  it('leaves input and native button Enter/Space to the control, while preserving explicit shortcuts', () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    for (const target of [ui.getByLabelText('Filter'), ui.getByText('Action')]) {
      fireEvent.keyDown(target, { key: 'Enter' })
      fireEvent.keyDown(target, { key: ' ' })
    }
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    expect(props.navigation.actions.openMainRelated).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByLabelText('Filter'), { key: 'F2' })
    expect(props.navigation.cart.open).toHaveBeenCalledOnce()
    fireEvent.keyDown(ui.getByLabelText('Search'), { key: 'ArrowLeft', ctrlKey: true })
    expect(props.navigation.details.cycle).not.toHaveBeenCalled()
  })

  it.each(['blockingOverlay', 'productCardOpen', 'crossSellOpen'] as const)('does not dispatch underneath %s', (flag) => {
    const props = { ...options(), [flag]: true }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    fireEvent.keyDown(ui.getByLabelText('Search'), { key: 'Enter' })
    fireEvent.keyDown(ui.getByTestId('details'), { key: 'Escape' })
    fireEvent.keyDown(document.body, { key: 'F3' })
    expect(props.navigation.main.focus).not.toHaveBeenCalled()
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    expect(props.closeProductDetails).not.toHaveBeenCalled()
    expect(props.setCartSheetOpen).not.toHaveBeenCalled()
  })

  it('ignores composition, modified native shortcuts and repeats of discrete actions, but allows held arrows', () => {
    const props = options()
    render(<Harness options={props} />)
    for (const event of [{ key: 'Enter', repeat: true }, { key: 'F2', repeat: true }, { key: 'F3', repeat: true },
      { key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }, { key: 'Enter', metaKey: true }, { key: 'Enter', altKey: true }]) {
      fireEvent.keyDown(document.body, event)
    }
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    expect(props.navigation.cart.open).not.toHaveBeenCalled()
    expect(props.setCartSheetOpen).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'ArrowDown', repeat: true })
    expect(props.navigation.main.focus).toHaveBeenCalledOnce()
  })

  it('opens the cart sheet only from a selection/search mode and keeps its commands separate', () => {
    const props = options()
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(document.body, { key: 'F3' })
    expect(props.setCartSheetOpen).toHaveBeenCalledWith(true)
    ui.rerender(<Harness options={{ ...props, cartSheetOpen: true }} />)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'F2' })
    expect(props.setCartSheetOpen).toHaveBeenLastCalledWith(false)
    expect(props.navigation.cart.open).toHaveBeenCalledOnce()
    vi.mocked(props.setCartSheetOpen).mockClear()
    ui.rerender(<Harness options={{ ...props, navigation: { ...props.navigation, state: 'FullDetail' } }} />)
    fireEvent.keyDown(document.body, { key: 'F3' })
    expect(props.setCartSheetOpen).not.toHaveBeenCalled()
  })

  it('does not close a cart sheet with the Escape from a nested modal', () => {
    const props = { ...options(), cartSheetOpen: true }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByTestId('child'), { key: 'Escape' })
    expect(props.setCartSheetOpen).not.toHaveBeenCalled()
  })

  it('keeps description typing in the detail drawer and closes only that drawer on Escape', () => {
    const props = options()
    props.navigation.state = 'EditProductDescription'
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByLabelText('Description'), { key: 'Enter' })
    fireEvent.keyDown(ui.getByText('Save'), { key: 'Enter' })
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByLabelText('Description'), { key: 'Escape', repeat: true })
    expect(props.closeProductDetails).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByLabelText('Description'), { key: 'Escape' })
    expect(props.closeProductDetails).toHaveBeenCalledOnce()
    expect(props.navigation.actions.toggleDescription).not.toHaveBeenCalled()
    fireEvent.keyDown(ui.getByLabelText('Description'), { key: 'F2' })
    expect(props.navigation.actions.toggleDescription).toHaveBeenCalledOnce()
  })

  it('ignores events bubbling from portaled child dialogs into the detail drawer', () => {
    const props = { ...options(), blockingOverlay: true }
    const ui = render(<Harness options={props} />)
    fireEvent.keyDown(ui.getByLabelText('Child field'), { key: 'Escape' })
    expect(props.closeProductDetails).not.toHaveBeenCalled()
  })

  it('uses current callbacks without resubscribing and cleans up the body fallback on unmount', () => {
    const props = options()
    const { result, rerender, unmount } = renderHook(useWizardProductKeyboard, { initialProps: props })
    const handler = result.current.handleProductKey
    const fresh = navigation()
    rerender({ ...props, navigation: fresh })
    expect(result.current.handleProductKey).toBe(handler)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(fresh.actions.add).toHaveBeenCalledOnce()
    expect(props.navigation.actions.add).not.toHaveBeenCalled()
    act(() => initializeWizardKeyboard(0))
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(fresh.actions.add).toHaveBeenCalledOnce()
    unmount()
    act(() => initializeWizardKeyboard(1))
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(fresh.actions.add).toHaveBeenCalledOnce()
  })
})
