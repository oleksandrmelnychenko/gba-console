import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/* Width updates are cached in state. Reading clientWidth directly from a render
   snapshot can cause repeated sync layout work and nested update loops. */
export function useElementClientWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0)
  const widthRef = useRef(0)
  const commitWidth = useCallback((nextWidth: number) => {
    const normalizedWidth = Number.isFinite(nextWidth)
      ? Math.max(0, Math.round(nextWidth))
      : 0

    if (widthRef.current === normalizedWidth) {
      return
    }

    widthRef.current = normalizedWidth
    setWidth(normalizedWidth)
  }, [])

  useLayoutEffect(() => {
    if (!element) {
      commitWidth(0)
      return undefined
    }

    commitWidth(element.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => commitWidth(element.clientWidth)

      window.addEventListener('resize', handleResize)

      return () => window.removeEventListener('resize', handleResize)
    }

    /* Always commit clientWidth — the same metric consumers lay out against.
       Committing the entry's border-box width feeds a value wider than the
       client area (borders + scrollbar gutters) back into the table, which
       toggles the horizontal scrollbar and re-fires the observer in a loop.
       The entry is only a change signal; the width is re-read fresh. */
    const observer = new ResizeObserver(() => {
      commitWidth(element.clientWidth)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [commitWidth, element])

  return width
}
