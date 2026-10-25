/** Runtime for the application JSX transform. No component-level setup is required. */
type UiEvent = {
  type: string
  currentTarget: EventTarget | null
  target: EventTarget | null
  nativeEvent?: object
  preventDefault: () => void
  stopPropagation: () => void
}

type AttributeRestore = { element: Element; name: string; previous: string | null; applied: string }
type Action = {
  scope: Element
  event: object
  depth: number
  tasks: Set<PromiseLike<unknown>>
  pending: number
  result: unknown
  attributes: AttributeRestore[]
  marked: boolean
}

const actions = new WeakMap<Element, Action>()
const wrappers = new WeakMap<(...args: never[]) => unknown, (...args: never[]) => unknown>()
let currentAction: Action | undefined

function isElement(value: unknown): value is Element {
  return !!value && typeof value === 'object' && 'nodeType' in value && value.nodeType === 1
}

function asEvent(value: unknown): UiEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as UiEvent
  return ['click', 'dblclick', 'submit'].includes(event.type)
    && isElement(event.currentTarget)
    && typeof event.preventDefault === 'function'
    && typeof event.stopPropagation === 'function' ? event : null
}

function setAttribute(action: Action, element: Element, name: string, applied: string) {
  action.attributes.push({ element, name, previous: element.getAttribute(name), applied })
  element.setAttribute(name, applied)
}

function markPending(action: Action) {
  if (action.marked) return
  action.marked = true
  setAttribute(action, action.scope, 'data-ui-action-pending', '')
  setAttribute(action, action.scope, 'aria-busy', 'true')
  if (action.scope.matches('button, input[type="submit"], input[type="image"], a, [role="button"]')) {
    setAttribute(action, action.scope, 'aria-disabled', 'true')
  }
  // Keep inputs enabled: disabling a fieldset would change FormData and validation.
  if (action.scope.tagName === 'FORM') {
    for (const element of Array.from((action.scope as HTMLFormElement).elements)) {
      if (element.matches('button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]')) {
        setAttribute(action, element, 'data-ui-action-pending', '')
        setAttribute(action, element, 'aria-disabled', 'true')
      }
    }
  }
}

function releaseIfFinished(action: Action) {
  if (action.depth || action.pending) return
  if (actions.get(action.scope) === action) actions.delete(action.scope)
  for (const { element, name, previous, applied } of action.attributes) {
    // Preserve attributes that React or the application changed during the request.
    if (element.getAttribute(name) !== applied) continue
    if (previous === null) element.removeAttribute(name)
    else element.setAttribute(name, previous)
  }
}

function reportUnexpectedError(error: unknown) {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error('[ui-action]', error)
}

function observe(action: Action, value: unknown) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || !('then' in value)
    || typeof value.then !== 'function') return
  const task = value as PromiseLike<unknown>
  if (action.tasks.has(task)) return
  action.tasks.add(task)
  action.pending += 1
  markPending(action)
  void Promise.resolve(task).then(
    () => { action.pending -= 1; releaseIfFinished(action) },
    (error: unknown) => {
      action.pending -= 1
      releaseIfFinished(action)
      reportUnexpectedError(error)
    },
  )
}

/** The transform uses this for discarded calls and `void work()` in nested helpers.
 * Outside the synchronous dispatch of a UI action this is a transparent no-op.
 * Observing the returned Promise covers all of its subsequent awaits.
 */
export function trackUiActionResult<T>(value: T): T {
  if (currentAction) observe(currentAction, value)
  return value
}

function submittingForm(element: Element): HTMLFormElement | null {
  if (element.tagName === 'BUTTON') {
    const button = element as HTMLButtonElement
    return button.type === 'submit' ? button.form : null
  }
  if (element.tagName === 'INPUT') {
    const input = element as HTMLInputElement
    return input.type === 'submit' || input.type === 'image' ? input.form : null
  }
  return null
}

/** Preserve the callback's identity, arguments, return value and synchronous work. */
export function guardUiAction<T>(handler: T): T {
  if (typeof handler !== 'function') return handler
  const original = handler as (...args: never[]) => unknown
  const cached = wrappers.get(original)
  if (cached) return cached as T

  const wrapped = function (this: unknown, ...args: never[]) {
    const event = asEvent(args[0])
    if (!event) return original.apply(this, args)
    const scope = event.type === 'submit' && isElement(event.target) && event.target.tagName === 'FORM'
      ? event.target : event.currentTarget as Element
    const eventToken = event.nativeEvent ?? event
    const form = event.type === 'click' ? submittingForm(scope) : null
    const pending = actions.get(scope) ?? (form ? actions.get(form) : undefined)
    if (pending && pending.event !== eventToken) {
      event.preventDefault()
      event.stopPropagation()
      return pending.result
    }

    const action = pending ?? {
      scope, event: eventToken, depth: 0, tasks: new Set<PromiseLike<unknown>>(),
      pending: 0, result: undefined, attributes: [], marked: false,
    }
    actions.set(scope, action)
    action.depth += 1
    const previous = currentAction
    currentAction = action
    try {
      const result = original.apply(this, args)
      action.result = result
      observe(action, result)
      return result
    } finally {
      currentAction = previous
      action.depth -= 1
      releaseIfFinished(action)
    }
  }
  wrappers.set(original, wrapped)
  wrappers.set(wrapped, wrapped)
  return wrapped as T
}

/** Includes handlers supplied through JSX spreads, preserving refs and other props. */
export function guardUiActionProps<T>(props: T): T {
  if (!props || typeof props !== 'object') return props
  const next = { ...props } as Record<string, unknown>
  for (const name of ['onClick', 'onClickCapture', 'onDoubleClick', 'onDoubleClickCapture', 'onSubmit', 'onSubmitCapture']) {
    if (name in next) next[name] = guardUiAction(next[name])
  }
  return next as T
}
