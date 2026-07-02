import { useLayoutEffect, useState } from 'react'

/* Width updates are cached in state and scheduled through RAF. Reading
   clientWidth directly from a render snapshot can cause repeated sync layout
   work and, in some table layouts, nested update loops. */
export function useElementClientWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!element) {
      setWidth(0)
      return undefined
    }

    let animationFrame = 0
    let lastWidth = element.clientWidth

    setWidth((currentWidth) => (currentWidth === lastWidth ? currentWidth : lastWidth))

    const updateWidth = () => {
      animationFrame = 0

      const nextWidth = element.clientWidth

      if (nextWidth === lastWidth) {
        return
      }

      lastWidth = nextWidth
      setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
    }

    const scheduleUpdate = () => {
      if (animationFrame) {
        return
      }

      animationFrame = window.requestAnimationFrame(updateWidth)
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleUpdate)

      return () => {
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame)
        }

        window.removeEventListener('resize', scheduleUpdate)
      }
    }

    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(element)

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      observer.disconnect()
    }
  }, [element])

  return width
}
