import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { getWizardKeyboardSnapshot, isEditableTarget, toWizardHotkey, useWizardKeyHandler, type WizardKeyEvent } from './wizardKeyboard'
import { dispatchWizardProductNavigation, type WizardProductKeyboardContext } from './wizardProductKeyboard'

type Options = {
  navigation: WizardProductKeyboardContext
  containerRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  blockingOverlay: boolean
  cartSheetOpen: boolean
  crossSellOpen: boolean
  productCardOpen: boolean
  setCartSheetOpen: (opened: boolean) => void
  closeProductDetails: () => void
}
const SELECTION_STATES = new Set(['ProductSearch', 'ProductSelection', 'AnalogueSelection', 'ComponentSelection'])

export function useWizardProductKeyboard(options: Options) {
  const latestRef = useRef(options)
  useLayoutEffect(() => { latestRef.current = options })

  const handleProductKey = useCallback((event: WizardKeyEvent): boolean => {
    const current = latestRef.current
    const { nativeEvent, hotkey } = event
    const native = 'nativeEvent' in nativeEvent ? nativeEvent.nativeEvent : nativeEvent
    const target = nativeEvent.target
    if (getWizardKeyboardSnapshot().activeStep !== 1 || nativeEvent.defaultPrevented || native.isComposing || native.keyCode === 229 ||
      nativeEvent.metaKey || nativeEvent.altKey || current.blockingOverlay || current.productCardOpen || current.crossSellOpen) return false
    if (target instanceof Element && target.closest('[data-wizard-keyboard-help]')) return false
    // Ctrl+arrow/delete belong to text editing, not carousel/cart navigation.
    if (nativeEvent.ctrlKey && !['Ctrl', 'CtrlEnter', 'CtrlI', 'CtrlB'].includes(hotkey)) return false
    if (event.inEditable && target !== current.searchInputRef.current && !nativeEvent.ctrlKey && hotkey !== 'F2' && hotkey !== 'F3') return false
    if (isInteractiveTarget(target) && !event.inEditable && (hotkey === 'Enter' || hotkey === 'Space')) return false
    if (nativeEvent.repeat && !hotkey.startsWith('Arrow')) return true

    if (current.cartSheetOpen) {
      // A child modal may already have closed in Mantine's capture handler.
      // Its closing Escape must not also dismiss the underlying cart sheet.
      if (target instanceof Element && target.closest('.mantine-Modal-content, .mantine-Drawer-content:not(.wizard-cart-sheet)')) return true
      if (hotkey === 'F2') { current.setCartSheetOpen(false); current.navigation.cart.open() }
      else if (hotkey === 'Escape' || hotkey === 'F3') current.setCartSheetOpen(false)
      return true
    }
    if (hotkey === 'F3') {
      if (!SELECTION_STATES.has(current.navigation.state)) return false
      current.setCartSheetOpen(true)
      return true
    }
    return dispatchWizardProductNavigation(hotkey, current.navigation)
  }, [])
  useWizardKeyHandler(handleProductKey)

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const current = latestRef.current
      const target = event.target
      if (current.containerRef.current?.contains(target as Node) || isInteractiveTarget(target) ||
        (target instanceof Element && target.closest('.new-sale-product-details-drawer, .new-sale-product-image-modal, .wizard-cart-sheet, [data-wizard-keyboard-help]'))) return
      const hotkey = toWizardHotkey(event)
      if (hotkey && handleProductKey({ hotkey, inEditable: isEditableTarget(target), nativeEvent: event })) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('keydown', listener, true)
    return () => document.removeEventListener('keydown', listener, true)
  }, [handleProductKey])

  const handleProductDetailsKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    // React portal events bubble through the drawer; child dialogs own them.
    if (!event.currentTarget.contains(event.target as Node)) return
    event.stopPropagation()
    const current = latestRef.current
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.metaKey || event.altKey ||
      current.blockingOverlay || current.productCardOpen || current.crossSellOpen || current.cartSheetOpen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!event.repeat) current.closeProductDetails()
      return
    }
    if (isEditableTarget(event.target) && !event.ctrlKey && event.key !== 'F2') return
    if (isInteractiveTarget(event.target) && !event.ctrlKey && (event.key === 'Enter' || event.key === ' ')) return
    const hotkey = toWizardHotkey(event)
    if (hotkey && handleProductKey({ hotkey, inEditable: isEditableTarget(event.target), nativeEvent: event })) event.preventDefault()
  }, [handleProductKey])

  return { handleProductKey, handleProductDetailsKeyDown }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  // Focus-trap wrappers have tabindex=-1 but must still allow the body fallback.
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest('a, button, input, select, textarea, [role="button"], [contenteditable="true"]')))
}
