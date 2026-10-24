import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getWizardKeyboardSnapshot, isEditableTarget, useWizardKeyboard, useWizardKeyHandler } from './wizardKeyboard'

type Options = {
  contextKey: string
  finalSubmitOutcomePending: boolean
  busy: boolean
  submitSale: () => Promise<void>
  submitFromKeyboard: () => void
  saveSale: () => Promise<boolean>
  onClose?: () => void
  onRequestClose?: () => void
  onRegisterSubmit?: (submit: (() => Promise<void>) | null) => void
}

export function useWizardReviewKeyboard(options: Options) {
  const [confirmation, setConfirmation] = useState({ contextKey: options.contextKey, opened: false })
  const confirmOpened = confirmation.contextKey === options.contextKey && confirmation.opened
  if (confirmation.contextKey !== options.contextKey) setConfirmation({ contextKey: options.contextKey, opened: false })
  const confirmRef = useRef(false)
  const generationRef = useRef(0)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const latestRef = useRef(options)
  useLayoutEffect(() => { latestRef.current = options })
  const cancelFocus = useCallback(() => {
    if (focusTimerRef.current !== null) clearTimeout(focusTimerRef.current)
    focusTimerRef.current = null
  }, [])
  useLayoutEffect(() => {
    confirmRef.current = false
    return () => { generationRef.current += 1; cancelFocus() }
  }, [options.contextKey, cancelFocus])
  const registeredSubmit = useCallback(() => latestRef.current.submitSale(), [])
  const { onRegisterSubmit } = options
  useEffect(() => {
    onRegisterSubmit?.(registeredSubmit)
    return () => onRegisterSubmit?.(null)
  }, [onRegisterSubmit, registeredSubmit])
  useEffect(() => { submitRef.current?.focus({ preventScroll: true }) }, [])
  useWizardKeyboard(2)
  useWizardKeyHandler((event) => {
    const native = 'nativeEvent' in event.nativeEvent ? event.nativeEvent.nativeEvent : event.nativeEvent
    const target = event.nativeEvent.target
    const current = latestRef.current
    if (getWizardKeyboardSnapshot().activeStep !== 2 || event.nativeEvent.defaultPrevented || native.isComposing || native.keyCode === 229 ||
      event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.altKey || confirmRef.current) return false
    if (target instanceof Element && target.closest('[data-wizard-keyboard-help], [data-review-combobox]')) return false
    if (event.hotkey !== 'Enter' && event.hotkey !== 'Escape') return false
    if (event.nativeEvent.repeat) return true
    if (event.hotkey === 'Escape') {
      if (current.finalSubmitOutcomePending) (current.onRequestClose ?? current.onClose)?.()
      else if (!current.busy) {
        cancelFocus()
        confirmRef.current = true
        setConfirmation({ contextKey: current.contextKey, opened: true })
      }
      return true
    }
    // Buttons keep their native Enter click, and text fields keep their input.
    if (isEditableTarget(target) || (target instanceof Element && target.closest('button, a, [role="button"], [contenteditable="true"]'))) return false
    if (!current.busy) current.submitFromKeyboard()
    return true
  })

  const handleConfirmClose = useCallback(async () => {
    if (!confirmRef.current) return
    confirmRef.current = false
    setConfirmation({ contextKey: latestRef.current.contextKey, opened: false })
    cancelFocus()
    const current = latestRef.current
    const generation = generationRef.current
    if (current.finalSubmitOutcomePending) { (current.onRequestClose ?? current.onClose)?.(); return }
    if (await current.saveSale() && generationRef.current === generation) latestRef.current.onClose?.()
  }, [cancelFocus])
  const handleCancelClose = useCallback(() => {
    if (!confirmRef.current) return
    confirmRef.current = false
    setConfirmation({ contextKey: latestRef.current.contextKey, opened: false })
    cancelFocus()
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null
      if (!confirmRef.current) submitRef.current?.focus({ preventScroll: true })
    }, 0)
  }, [cancelFocus])

  return { confirmOpened, submitRef, handleConfirmClose, handleCancelClose }
}
