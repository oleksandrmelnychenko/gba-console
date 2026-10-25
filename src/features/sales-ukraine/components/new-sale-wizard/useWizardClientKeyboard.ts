import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { WizardClientCarouselController } from './useWizardClientCarousel'
import { getWizardKeyboardSnapshot, getWizardKeyboardState, isEditableTarget, toWizardHotkey,
  useWizardKeyboard, useWizardKeyHandler, type WizardHotkey } from './wizardKeyboard'

type Options = {
  navigation: WizardClientCarouselController
  hasOpenOverlay: boolean
  unselectClient: () => void
  selectNextAgreement: () => void
  selectPreviousAgreement: () => void
  setQuery: (value: string) => void
  handleQueryChange: (value: string) => boolean | void
  onRequestClose?: () => void
}

export function useWizardClientKeyboard(options: Options) {
  const { state: keyboardState, setState } = useWizardKeyboard(0)
  const latestRef = useRef(options)
  useLayoutEffect(() => { latestRef.current = options })
  const { hasOpenOverlay, navigation: { cancelPendingFocus, cancelPendingMove } } = options
  useLayoutEffect(() => {
    if (hasOpenOverlay) { cancelPendingFocus(); cancelPendingMove() }
  }, [hasOpenOverlay, cancelPendingFocus, cancelPendingMove])

  // Both the document capture listener and the wizard's React dispatcher use
  // the same rules, so portals and focus changes cannot bypass overlay guards.
  const handleKey = useCallback((event: KeyboardEvent | ReactKeyboardEvent<HTMLElement>, hotkey: WizardHotkey | null): boolean => {
    const current = latestRef.current
    const native = 'nativeEvent' in event ? event.nativeEvent : event
    if (current.hasOpenOverlay || getWizardKeyboardSnapshot().activeStep !== 0 || event.defaultPrevented ||
      native.isComposing || native.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return false
    const target = event.target
    const help = target instanceof Element ? target.closest('[data-wizard-keyboard-help]') : null
    if (help && (help.getAttribute('role') === 'dialog' || help.getAttribute('aria-expanded') === 'true' || hotkey === 'Enter' || hotkey === 'Space')) return false
    const { navigation } = current
    const carousel = navigation.getCarousel()
    const ownSearch = target === navigation.searchInputRef.current
    if (hotkey !== 'Escape' && isEditableTarget(target) && !ownSearch) return false
    const state = getWizardKeyboardState(0)

    switch (hotkey) {
      case 'ArrowUp':
      case 'ArrowDown':
        if (!carousel.dataTop.length && !carousel.dataBottom.length) return false
        navigation.move(hotkey === 'ArrowUp' ? 'up' : 'down')
        if (state === 'ClientSearch') setState('ClientSelection')
        return true
      case 'ArrowLeft':
      case 'ArrowRight':
        if (state !== 'ClientSelection' && state !== 'ClientAgreementSelection') return false
        navigation.cancelPendingMove()
        setState('ClientAgreementSelection')
        if (hotkey === 'ArrowRight') current.selectNextAgreement()
        else current.selectPreviousAgreement()
        return true
      case 'Enter': {
        const inDrum = target instanceof Element && Boolean(target.closest('.new-sale-client-drum'))
        const interactive = target instanceof Element && Boolean(target.closest('button, a, [role="button"]'))
        if (!carousel.selected || interactive || (!ownSearch && !inDrum && target !== document.body)) return false
        if (!event.repeat) navigation.confirmFocusedClient()
        return true
      }
      case 'Escape':
        if (event.repeat) return true
        if (state === 'ClientSelection') {
          navigation.hideDetails()
          setState('ClientSearch')
          current.setQuery('')
          navigation.focusSearchInput()
        } else if (state === 'ClientAgreementSelection') {
          setState('ClientSelection')
        } else current.onRequestClose?.()
        return true
      default:
        return false
    }
  }, [setState])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!handleKey(event, toWizardHotkey(event))) return
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', listener, true)
    return () => document.removeEventListener('keydown', listener, true)
  }, [handleKey])
  useWizardKeyHandler((event) => handleKey(event.nativeEvent, event.hotkey))

  const handleSearchChange = useCallback((value: string) => {
    setState('ClientSearch')
    latestRef.current.navigation.cancelPendingMove()
    if (latestRef.current.handleQueryChange(value) === false) return
    latestRef.current.unselectClient()
    latestRef.current.navigation.applySearchResults([])
  }, [setState])
  return { keyboardState, handleSearchChange }
}
