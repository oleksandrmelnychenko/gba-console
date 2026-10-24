import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useWizardModalActions } from './useWizardModalActions'

export function useWizardQuantityForm({
  availableQty, busy = false, initialQty = 0, initialComment = '', opened, sessionKey = '', onAccept, onCancel,
}: {
  availableQty: number
  busy?: boolean
  initialQty?: number
  initialComment?: string
  opened: boolean
  sessionKey?: string
  onAccept: (qty: number, comment: string) => void | Promise<unknown>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState({ opened, sessionKey, value: initialQty > 0 ? initialQty as number | string : '', comment: initialComment, touched: false })
  const sameSession = draft.opened === opened && draft.sessionKey === sessionKey
  const current = sameSession ? draft : { opened, sessionKey, value: initialQty > 0 ? initialQty : '', comment: initialComment, touched: false }
  if (!sameSession) setDraft(current)
  const draftRef = useRef(current)
  useLayoutEffect(() => { draftRef.current = current })
  const update = useCallback((patch: Partial<Pick<typeof draft, 'value' | 'comment' | 'touched'>>) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
  }, [])
  const setValue = useCallback((value: number | string) => update({ value, touched: true }), [update])
  const setComment = useCallback((comment: string) => update({ comment }), [update])
  const actions = useWizardModalActions({
    opened, busy, sessionKey, onCancel,
    onConfirm: () => {
      update({ touched: true })
      const { value, comment } = draftRef.current
      const qty = parseQuantity(value)
      if (isValidQuantity(qty, availableQty)) return onAccept(qty, comment)
    },
  })
  const showError = current.touched && !isValidQuantity(parseQuantity(current.value), availableQty)
  return { ...actions, value: current.value, comment: current.comment, showError, setValue, setComment }
}

function parseQuantity(value: number | string): number {
  return typeof value === 'number' ? value : Number(value.replace(',', '.'))
}
function isValidQuantity(qty: number, available: number): boolean {
  return Number.isFinite(qty) && qty > 0 && qty <= available
}
