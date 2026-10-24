import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

type Options = {
  opened: boolean
  busy?: boolean
  sessionKey?: string
  onConfirm: () => void | Promise<unknown>
  onCancel: () => void
}

export function useWizardModalActions(options: Options) {
  const { opened, sessionKey = '' } = options
  const [pending, setPending] = useState({ opened, sessionKey, value: false })
  const sameSession = pending.opened === opened && pending.sessionKey === sessionKey
  if (!sameSession) setPending({ opened, sessionKey, value: false })
  const latestRef = useRef(options)
  const sessionRef = useRef<{ pending: boolean; cancelled: boolean } | null>(null)
  useLayoutEffect(() => { latestRef.current = options })
  useLayoutEffect(() => {
    sessionRef.current = opened ? { pending: false, cancelled: false } : null
    return () => { sessionRef.current = null }
  }, [opened, sessionKey])

  const confirm = useCallback(async () => {
    const session = sessionRef.current
    const current = latestRef.current
    if (!session || session.pending || session.cancelled || current.busy) return
    // Acquire synchronously: a click and Enter can arrive before busy is rendered.
    session.pending = true
    setPending({ opened: current.opened, sessionKey: current.sessionKey ?? '', value: true })
    try {
      await current.onConfirm()
    } finally {
      if (sessionRef.current === session) {
        session.pending = false
        setPending({ opened: current.opened, sessionKey: current.sessionKey ?? '', value: false })
      }
    }
  }, [])
  const cancel = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.pending || session.cancelled || latestRef.current.busy) return
    session.cancelled = true
    latestRef.current.onCancel()
  }, [])
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.target as Node) || (event.key !== 'Enter' && event.key !== 'Escape')) return
    event.stopPropagation()
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.repeat) { event.preventDefault(); return }
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    // Native Enter activates the focused button (including Cancel), not the form.
    if (event.target instanceof Element && event.target.closest('button, a, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    return confirm()
  }, [cancel, confirm])

  return { confirm, cancel, handleKeyDown, isBusy: Boolean(options.busy || (sameSession && pending.value)) }
}
