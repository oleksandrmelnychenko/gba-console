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
    let animationFrameId = 0
    const scheduleWidthCommit = (nextWidth: number) => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0
        commitWidth(nextWidth)
      })
    }

    if (!element) {
      scheduleWidthCommit(0)

      return () => {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId)
        }
      }
    }

    scheduleWidthCommit(element.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => scheduleWidthCommit(element.clientWidth)

      window.addEventListener('resize', handleResize)

      return () => {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId)
        }

        window.removeEventListener('resize', handleResize)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const borderBox = Array.isArray(entry?.borderBoxSize) ? entry.borderBoxSize[0] : entry?.borderBoxSize

      scheduleWidthCommit(borderBox?.inlineSize ?? entry?.contentRect.width ?? element.clientWidth)
    })
    observer.observe(element)

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      observer.disconnect()
    }
  }, [commitWidth, element])

  return width
}
