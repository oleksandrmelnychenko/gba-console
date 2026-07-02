import { useCallback, useLayoutEffect, useState } from 'react'

/* Width updates are cached in state. Reading clientWidth directly from a render
   snapshot can cause repeated sync layout work and nested update loops. */
export function useElementClientWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0)
  const commitWidth = useCallback((nextWidth: number) => {
    const normalizedWidth = Math.max(0, Math.round(nextWidth))

    setWidth((currentWidth) => (currentWidth === normalizedWidth ? currentWidth : normalizedWidth))
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

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const borderBox = Array.isArray(entry?.borderBoxSize) ? entry.borderBoxSize[0] : entry?.borderBoxSize

      commitWidth(borderBox?.inlineSize ?? entry?.contentRect.width ?? element.clientWidth)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [commitWidth, element])

  useLayoutEffect(() => {
    if (element) {
      commitWidth(element.clientWidth)
    }
  })

  return width
}
