import { useEffect, useRef } from 'react'

/**
 * Closes a header popover on Escape even when focus stayed on its trigger button (Mantine's own
 * closeOnEscape only reacts to key presses inside the dropdown).
 */
export function useCloseOnEscape(opened: boolean, close: () => void): void {
  const closeRef = useRef(close)

  useEffect(() => {
    closeRef.current = close
  }, [close])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        closeRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [opened])
}
