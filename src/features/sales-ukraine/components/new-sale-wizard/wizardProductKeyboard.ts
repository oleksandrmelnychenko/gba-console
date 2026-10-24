import type { WizardAvailabilityRow } from './newSaleWizardApi'
import type { WizardHotkey, WizardProductKeyboardState } from './wizardKeyboard'
import type { WizardSaleProduct } from './wizardSaleProduct'

type ProductList = {
  count: number
  index: number | null
  product: WizardSaleProduct | null
  focus: (index: number, options?: { keepDetail?: boolean }) => void
}
export type WizardProductKeyboardContext = {
  state: WizardProductKeyboardState
  isMainActive: boolean
  main: ProductList
  analogue: ProductList & { parentNetUid?: string | null; escape: () => void }
  component: ProductList
  details: {
    chipIndex: number | null
    rowIndex: number | null
    chipCount: number
    rowsFor: (product: WizardSaleProduct | null) => WizardAvailabilityRow[]
    cycle: (direction: 1 | -1, count: number) => void
    navigate: (direction: 1 | -1, count: number) => void
    reset: () => void
    select: (selection: { chipIndex: number | null; rowIndex: number | null }) => void
    shift: (row: WizardAvailabilityRow) => void
  }
  cart: {
    hasSelection: boolean
    open: () => void
    move: (direction: 1 | -1) => void
    edit: () => Promise<void>
    toggleSplit: () => void
    remove: () => void
    exit: () => Promise<void>
  }
  actions: {
    setState: (state: WizardProductKeyboardState) => void
    add: (product: WizardSaleProduct | null) => Promise<void>
    openMainDetail: () => boolean
    openMainRelated: () => void
    clearSelection: () => void
    returnToMain: () => void
    openImage: (product: WizardSaleProduct | null) => void
    openInterest: (product: WizardSaleProduct | null) => void
    closeImage: () => void
    closeInterest: () => void
    toggleDescription: () => Promise<void>
    requestClose?: () => void
  }
}

// Navigation policy only: event ownership, portals and native controls are
// handled by useWizardProductKeyboard. Mutations stay in the cart controller.
export function dispatchWizardProductNavigation(hotkey: WizardHotkey, context: WizardProductKeyboardContext): boolean {
  const { state, main, analogue, component, details, cart, actions } = context
  if (state === 'EditShoppingCart') {
    switch (hotkey) {
      case 'ArrowDown': cart.move(1); return true
      case 'ArrowUp': cart.move(-1); return true
      case 'Enter': void cart.edit(); return true
      case 'Space': cart.toggleSplit(); return true
      case 'Delete': if (cart.hasSelection) cart.remove(); return true
      case 'Escape': void cart.exit(); return true
      case 'CtrlEnter': return true
      default: return false
    }
  }
  if (state === 'ViewImage' || state === 'Interest') {
    if (hotkey === 'Escape' || hotkey === 'F2') {
      if (state === 'ViewImage') actions.closeImage()
      else actions.closeInterest()
      if (hotkey === 'F2') cart.open()
      return true
    }
    return ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'CtrlEnter'].includes(hotkey)
  }
  if (state === 'EditProductDescription') {
    if (hotkey === 'Enter') { void actions.add(main.product); return true }
    if (hotkey === 'F2') { void actions.toggleDescription(); cart.open(); return true }
    return false
  }
  if (hotkey === 'F2') { cart.open(); return true }
  if (state === 'ProductSearch') {
    switch (hotkey) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!main.count) return true
        const middle = Math.floor(main.count / 2)
        main.focus(hotkey === 'ArrowDown' ? middle : Math.max(middle - 1, 0))
        actions.setState('ProductSelection')
        return true
      }
      case 'Enter':
        if (!context.isMainActive || !main.product) return false
        void actions.add(main.product)
        return true
      case 'CtrlEnter': actions.openMainDetail(); return true
      case 'Escape': actions.requestClose?.(); return true
      default: return false
    }
  }

  const kind = state === 'AnalogueSelection' || state === 'AnalogueFullDetail' ? 'analogue'
    : state === 'ComponentSelection' || state === 'ComponentFullDetail' ? 'component' : 'main'
  const list = kind === 'analogue' ? analogue : kind === 'component' ? component : main
  const fullDetail = state === 'FullDetail' || state === 'AnalogueFullDetail' || state === 'ComponentFullDetail'
  const selectionState = kind === 'main' ? 'ProductSelection' : kind === 'analogue' ? 'AnalogueSelection' : 'ComponentSelection'
  const openComponentAnalogues = () => {
    if (component.product?.HasAnalogue && analogue.parentNetUid === component.product.NetUid && analogue.count > 0) {
      if (fullDetail) details.reset()
      actions.setState('AnalogueSelection')
      analogue.focus(0)
    }
  }

  switch (hotkey) {
    case 'ArrowLeft':
    case 'ArrowRight':
      if (!fullDetail) return false
      details.cycle(hotkey === 'ArrowLeft' ? -1 : 1, details.chipCount)
      return true
    case 'ArrowDown':
    case 'ArrowUp': {
      const direction = hotkey === 'ArrowDown' ? 1 : -1
      // Resolve availability rows only for keys that actually use them.
      const rows = fullDetail ? details.rowsFor(list.product) : []
      if (fullDetail && rows.length && (kind !== 'main' || details.chipIndex === 0)) {
        details.navigate(direction, rows.length)
      } else if (!fullDetail || list.index !== null) {
        const next = list.index === null ? 0 : Math.max(0, Math.min(list.index + direction, list.count - 1))
        if (list.count > 0) {
          if (fullDetail) list.focus(next, { keepDetail: true })
          else list.focus(next)
        }
      }
      return true
    }
    case 'Enter':
      if (kind === 'main' || list.product) void actions.add(list.product)
      return true
    case 'CtrlEnter':
      if (fullDetail) return true
      if (kind === 'main') actions.openMainDetail()
      else if (kind === 'analogue' || list.product) {
        details.select({ chipIndex: null, rowIndex: null })
        actions.setState(kind === 'analogue' ? 'AnalogueFullDetail' : 'ComponentFullDetail')
      }
      return true
    case 'Ctrl': {
      if (!fullDetail) return false
      if (kind === 'main' && details.chipIndex === 0 && details.rowIndex !== null) {
        const row = details.rowsFor(list.product)[details.rowIndex]
        if (row) details.shift(row)
      }
      return true
    }
    case 'CtrlI':
    case 'CtrlB':
      if (kind === 'main' || fullDetail) {
        if (hotkey === 'CtrlI') actions.openImage(list.product)
        else actions.openInterest(list.product)
      }
      return true
    case 'Space':
      if (kind === 'main') actions.openMainRelated()
      else if (!fullDetail && list.index === null && list.count > 0) list.focus(0)
      else if (kind === 'component') openComponentAnalogues()
      return true
    case 'Escape':
      if (fullDetail) {
        if (kind !== 'main' && details.chipIndex !== null) details.select({ chipIndex: null, rowIndex: null })
        else { details.reset(); actions.setState(selectionState) }
      } else if (kind === 'main') actions.clearSelection()
      else if (kind === 'analogue') analogue.escape()
      else actions.returnToMain()
      return true
    default: return false
  }
}
