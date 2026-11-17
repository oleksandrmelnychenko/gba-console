import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Closes a page opened as an overlay. Going back is right when the user got here inside the
 * console, but on a deep link (typed URL, bookmark, new tab) "back" leaves for whatever page
 * was open before, e.g. /products. React Router marks the first entry of a session with the
 * key "default"; then go to `fallbackPath` instead.
 */
export function useCloseToFallback(fallbackPath: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const hasInAppHistory = location.key !== 'default'

  return useCallback(() => {
    if (hasInAppHistory) {
      navigate(-1)
    } else {
      navigate(fallbackPath, { replace: true })
    }
  }, [fallbackPath, hasInAppHistory, navigate])
}
