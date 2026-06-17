import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export type WizardStepIndex = 0 | 1 | 2

export const WIZARD_STEP_TITLES: Record<WizardStepIndex, string> = {
  0: 'Клієнти',
  1: 'Товари',
  2: 'Перевізники',
}

export const WIZARD_CLIENT_KEYBOARD_STATES = ['ClientSearch', 'ClientSelection', 'ClientAgreementSelection'] as const

export const WIZARD_PRODUCT_KEYBOARD_STATES = [
  'ProductSearch',
  'ProductSelection',
  'FullDetail',
  'AnalogueSelection',
  'AnalogueFullDetail',
  'ComponentSelection',
  'ComponentFullDetail',
  'EditProductDescription',
  'EditShoppingCart',
  'ViewImage',
  'Interest',
] as const

export const WIZARD_REVIEW_KEYBOARD_STATES = [
  'TransporterSelection',
  'RecipientSelection',
  'AddressSelection',
  'RecipientNew',
  'AddressNew',
  'EnterAdditionalInformation',
] as const

export type WizardClientKeyboardState = (typeof WIZARD_CLIENT_KEYBOARD_STATES)[number]
export type WizardProductKeyboardState = (typeof WIZARD_PRODUCT_KEYBOARD_STATES)[number]
export type WizardReviewKeyboardState = (typeof WIZARD_REVIEW_KEYBOARD_STATES)[number]
export type WizardKeyboardState = WizardClientKeyboardState | WizardProductKeyboardState | WizardReviewKeyboardState

export const WIZARD_KEYBOARD_STATE_LABELS: Record<WizardKeyboardState, string> = {
  ClientSearch: 'Пошук клієнта',
  ClientSelection: 'Вибір клієнта',
  ClientAgreementSelection: 'Вибір договору',
  ProductSearch: 'Пошук товару',
  ProductSelection: 'Вибір товару',
  FullDetail: 'Детальний огляд товару',
  AnalogueSelection: 'Вибір аналогів',
  AnalogueFullDetail: 'Детальний огляд аналога',
  ComponentSelection: 'Вибір компонента',
  ComponentFullDetail: '',
  EditProductDescription: '',
  EditShoppingCart: 'Редагування рахунку',
  ViewImage: 'Перегляд зображення',
  Interest: '',
  TransporterSelection: 'Вибір перевізника',
  RecipientSelection: 'Вибір одержувача',
  AddressSelection: 'Вибір адреси',
  RecipientNew: 'Новий одержувач',
  AddressNew: 'Нова адреса',
  EnterAdditionalInformation: 'Додаткова інформація',
}

const STEP_STATE_ORDER: Record<WizardStepIndex, readonly WizardKeyboardState[]> = {
  0: WIZARD_CLIENT_KEYBOARD_STATES,
  1: WIZARD_PRODUCT_KEYBOARD_STATES,
  2: WIZARD_REVIEW_KEYBOARD_STATES,
}

const STEP_INITIAL_STATE: Record<WizardStepIndex, WizardKeyboardState> = {
  0: 'ClientSearch',
  1: 'ProductSearch',
  2: 'TransporterSelection',
}

export type WizardKeyboardSnapshot = {
  activeStep: WizardStepIndex
  state: WizardKeyboardState
  label: string
}

const store: {
  activeStep: WizardStepIndex
  previousProductState: WizardProductKeyboardState
  skipNextEscape: boolean
  stepStates: Record<WizardStepIndex, WizardKeyboardState>
} = {
  activeStep: 0,
  previousProductState: 'ProductSearch',
  skipNextEscape: false,
  stepStates: { ...STEP_INITIAL_STATE },
}

const listeners = new Set<() => void>()

function buildSnapshot(): WizardKeyboardSnapshot {
  const state = store.stepStates[store.activeStep]

  return { activeStep: store.activeStep, label: WIZARD_KEYBOARD_STATE_LABELS[state], state }
}

let snapshot: WizardKeyboardSnapshot = buildSnapshot()

function notify() {
  snapshot = buildSnapshot()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function findStepForState(state: WizardKeyboardState): WizardStepIndex {
  if ((WIZARD_CLIENT_KEYBOARD_STATES as readonly string[]).includes(state)) {
    return 0
  }

  if ((WIZARD_PRODUCT_KEYBOARD_STATES as readonly string[]).includes(state)) {
    return 1
  }

  return 2
}

export function getWizardKeyboardSnapshot(): WizardKeyboardSnapshot {
  return snapshot
}

export function getWizardKeyboardState(step?: WizardStepIndex): WizardKeyboardState {
  return store.stepStates[step ?? store.activeStep]
}

export function initializeWizardKeyboard(step: WizardStepIndex): void {
  if (store.activeStep !== step) {
    store.activeStep = step
    notify()
  }
}

export function setWizardKeyboardState(state: WizardKeyboardState): void {
  const step = findStepForState(state)

  if (step === 1) {
    store.previousProductState = store.stepStates[1] as WizardProductKeyboardState
  }

  store.stepStates[step] = state
  notify()
}

export function goBackWizardKeyboardState(): void {
  const step = store.activeStep

  if (step === 2) {
    return
  }

  const order = STEP_STATE_ORDER[step]
  const index = order.indexOf(store.stepStates[step])

  if (index > 0) {
    store.stepStates[step] = order[index - 1] as WizardKeyboardState
    notify()
  }
}

export function getPreviousProductKeyboardState(): WizardProductKeyboardState {
  return store.previousProductState
}

export function restorePreviousProductKeyboardState(): void {
  store.stepStates[1] = store.previousProductState
  notify()
}

export function consumeNextWizardEscape(): void {
  store.skipNextEscape = true
}

export function resetWizardKeyboard(): void {
  store.activeStep = 0
  store.previousProductState = 'ProductSearch'
  store.skipNextEscape = false
  store.stepStates = { ...STEP_INITIAL_STATE }
  notify()
}

export function useWizardKeyboardSnapshot(): WizardKeyboardSnapshot {
  return useSyncExternalStore(subscribe, getWizardKeyboardSnapshot)
}

export function useWizardKeyboard(step: WizardStepIndex): {
  consumeNextEscape: () => void
  goBack: () => void
  label: string
  restorePreviousProductState: () => void
  setState: (state: WizardKeyboardState) => void
  state: WizardKeyboardState
} {
  useEffect(() => {
    initializeWizardKeyboard(step)
  }, [step])

  const current = useWizardKeyboardSnapshot()

  return {
    consumeNextEscape: consumeNextWizardEscape,
    goBack: goBackWizardKeyboardState,
    label: current.label,
    restorePreviousProductState: restorePreviousProductKeyboardState,
    setState: setWizardKeyboardState,
    state: current.state,
  }
}

export type WizardHotkey =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'Ctrl'
  | 'CtrlB'
  | 'CtrlEnter'
  | 'CtrlI'
  | 'Delete'
  | 'Enter'
  | 'Escape'
  | 'F2'
  | 'Space'

export type WizardKeyEvent = {
  hotkey: WizardHotkey
  inEditable: boolean
  nativeEvent: ReactKeyboardEvent<HTMLElement> | KeyboardEvent
}

export type WizardKeyHandler = (event: WizardKeyEvent) => boolean | void

const keyHandlers = new Set<WizardKeyHandler>()

export function registerWizardKeyHandler(handler: WizardKeyHandler): () => void {
  keyHandlers.add(handler)

  return () => {
    keyHandlers.delete(handler)
  }
}

export function useWizardKeyHandler(handler: WizardKeyHandler): void {
  const handlerRef = useRef<WizardKeyHandler>(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => registerWizardKeyHandler((event) => handlerRef.current(event)), [])
}

export function toWizardHotkey(event: ReactKeyboardEvent<HTMLElement> | KeyboardEvent): WizardHotkey | null {
  if (event.ctrlKey) {
    if (event.key === 'Control') {
      return 'Ctrl'
    }

    if (event.key === 'Enter') {
      return 'CtrlEnter'
    }

    const key = event.key.toLowerCase()

    if (key === 'i') {
      return 'CtrlI'
    }

    if (key === 'b') {
      return 'CtrlB'
    }
  }

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
      return event.key
    case 'Delete':
      return 'Delete'
    case 'Enter':
      return 'Enter'
    case 'Escape':
      return 'Escape'
    case 'F2':
      return 'F2'
    case ' ':
      return 'Space'
    default:
      return null
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

export function dispatchWizardKey(event: ReactKeyboardEvent<HTMLElement>): boolean {
  const hotkey = toWizardHotkey(event)

  if (!hotkey) {
    return false
  }

  if (hotkey === 'Escape' && store.skipNextEscape) {
    store.skipNextEscape = false
    event.preventDefault()
    event.stopPropagation()

    return true
  }

  const keyEvent: WizardKeyEvent = { hotkey, inEditable: isEditableTarget(event.target), nativeEvent: event }
  let consumed = false

  keyHandlers.forEach((keyHandler) => {
    if (keyHandler(keyEvent) === true) {
      consumed = true
    }
  })

  if (consumed) {
    event.preventDefault()
    event.stopPropagation()
  }

  return consumed
}
