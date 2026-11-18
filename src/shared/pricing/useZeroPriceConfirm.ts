import { useCallback, useRef, useState } from 'react'
import type { ZeroPriceConfirmModalProps } from './ZeroPriceConfirmModal'

/**
 * `confirmZeroPrice()` opens the question and resolves true on «Продовжити», false on «Скасувати» / close.
 * Render `<ZeroPriceConfirmModal {...zeroPriceModalProps} />` next to the form.
 */
export function useZeroPriceConfirm() {
  const [opened, setOpened] = useState(false)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setOpened(false)
    resolve?.(confirmed)
  }, [])

  const confirmZeroPrice = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false)
        resolverRef.current = resolve
        setOpened(true)
      }),
    [],
  )

  const zeroPriceModalProps: ZeroPriceConfirmModalProps = {
    opened,
    onCancel: () => settle(false),
    onConfirm: () => settle(true),
  }

  return { confirmZeroPrice, zeroPriceModalProps }
}
