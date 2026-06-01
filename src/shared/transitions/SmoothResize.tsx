import {
  useCallback,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'

type SmoothResizeProps = PropsWithChildren<{
  className?: string
  duration?: number
  maxHeight?: number | string
}>

const RESIZE_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

export function SmoothResize({ children, className, duration = 300, maxHeight }: SmoothResizeProps) {
  const [innerNode, setInnerNode] = useState<HTMLDivElement | null>(null)
  const height = useElementHeight(innerNode)
  const setInnerRef = useCallback((node: HTMLDivElement | null) => {
    setInnerNode(node)
  }, [])

  return (
    <div
      className={className}
      style={{
        height: height === null ? undefined : height,
        maxHeight,
        overflowX: 'hidden',
        overflowY: maxHeight ? 'auto' : 'hidden',
        transition: height === null ? undefined : `height ${duration}ms ${RESIZE_EASING}`,
      }}
    >
      <div ref={setInnerRef}>{children}</div>
    </div>
  )
}

function useElementHeight(element: HTMLElement | null): number | null {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!element || typeof ResizeObserver === 'undefined') {
      return () => undefined
    }

    const observer = new ResizeObserver(onStoreChange)
    observer.observe(element)

    return () => observer.disconnect()
  }, [element])
  const getSnapshot = useCallback(() => {
    // Use the layout height (offsetHeight), not getBoundingClientRect().height:
    // the latter is affected by the modal's pop-in transform: scale(), which would
    // lock the container at a too-small height (clipping the last rows) because the
    // ResizeObserver never re-fires when only the transform settles.
    return element ? element.offsetHeight : null
  }, [element])

  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
