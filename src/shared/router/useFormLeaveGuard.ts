import { useEffect } from 'react'
import { useBrowserBackGuard } from './useBrowserBackGuard'

/**
 * For full-page forms with their own «Закрити без збереження?» dialog (WH2-23): while `isDirty`, browser Back
 * opens that dialog via `onBack` instead of leaving silently, and a reload / tab close asks the browser's
 * native question.
 */
export function useFormLeaveGuard(isDirty: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!isDirty) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useBrowserBackGuard(isDirty, onBack)
}
