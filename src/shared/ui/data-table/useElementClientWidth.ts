import { useCallback, useRef, useSyncExternalStore } from 'react'

/* Width comes from the ResizeObserver entries and is cached: getSnapshot must
   not read element.clientWidth directly — useSyncExternalStore calls it on every
   render/commit and a live clientWidth read forces a synchronous reflow right
   after React mutates the DOM (measurable on resize-drag mousemoves). */
export function useElementClientWidth(element: HTMLElement | null) {
  const widthRef = useRef(0)

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!element) {
        widthRef.current = 0
        return () => undefined
      }

      widthRef.current = element.clientWidth

      if (typeof ResizeObserver === 'undefined') {
        const handleResize = () => {
          widthRef.current = element.clientWidth
          onStoreChange()
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }

      const observer = new ResizeObserver(() => {
        widthRef.current = element.clientWidth
        onStoreChange()
      })
      observer.observe(element)

      return () => observer.disconnect()
    },
    [element],
  )
  const getSnapshot = useCallback(
    () => (element ? widthRef.current : 0),
    [element],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
