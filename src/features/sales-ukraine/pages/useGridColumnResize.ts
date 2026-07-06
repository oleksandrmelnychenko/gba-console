import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN_COLUMN_PX = 44

/**
 * Manual column resizing for the hand-rolled CSS-grid sales list (which is not a
 * TanStack DataTable, so it can't use that resize handler). Each column keeps its
 * fluid default until the user drags its header handle, at which point it becomes
 * a fixed px width; the remaining fluid columns keep filling the row. Widths are
 * persisted per storageKey so the layout survives reloads. Double-click a handle
 * to drop the override back to the fluid default.
 */
export function useGridColumnResize(defaults: string[], storageKey: string) {
  const [widths, setWidths] = useState<(number | null)[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)

      if (raw) {
        const parsed = JSON.parse(raw)

        if (Array.isArray(parsed) && parsed.length === defaults.length) {
          return parsed.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
        }
      }
    } catch {
      // Ignore malformed / unavailable storage — fall back to fluid defaults.
    }

    return defaults.map(() => null)
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths))
    } catch {
      // Ignore quota / privacy-mode errors — resizing still works in-session.
    }
  }, [storageKey, widths])

  const template = defaults.map((def, index) => (widths[index] != null ? `${widths[index]}px` : def)).join(' ')

  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null)

  const startResize = useCallback((index: number, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const cell = event.currentTarget.parentElement
    const startWidth = cell ? cell.getBoundingClientRect().width : 0
    dragRef.current = { index, startWidth, startX: event.clientX }

    const onMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current

      if (!drag) {
        return
      }

      const next = Math.max(MIN_COLUMN_PX, Math.round(drag.startWidth + (moveEvent.clientX - drag.startX)))

      setWidths((prev) => {
        if (prev[drag.index] === next) {
          return prev
        }

        const copy = [...prev]
        copy[drag.index] = next

        return copy
      })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const resetColumn = useCallback((index: number) => {
    setWidths((prev) => {
      if (prev[index] == null) {
        return prev
      }

      const copy = [...prev]
      copy[index] = null

      return copy
    })
  }, [])

  return { resetColumn, startResize, template }
}
