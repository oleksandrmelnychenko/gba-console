import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Brand orange used for every "create new" call-to-action lifted into the header. */
export const CREATE_ACTION_COLOR = '#E8782E'

type PageHeaderActionsContextValue = {
  container: HTMLElement | null
  setContainer: (element: HTMLElement | null) => void
}

const PageHeaderActionsContext = createContext<PageHeaderActionsContextValue>({
  container: null,
  setContainer: () => {},
})

/**
 * Wraps the console shell so the header slot and the routed pages share one
 * portal target. Pages render their primary action via {@link PageHeaderActions}
 * and it teleports into {@link PageHeaderActionsSlot} placed in the header.
 */
export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  return (
    <PageHeaderActionsContext.Provider value={{ container, setContainer }}>
      {children}
    </PageHeaderActionsContext.Provider>
  )
}

/** Render exactly once in the header — the destination for page actions. */
export function PageHeaderActionsSlot({ className }: { className?: string }) {
  const { setContainer } = useContext(PageHeaderActionsContext)
  const refCallback = useCallback(
    (element: HTMLDivElement | null) => setContainer(element),
    [setContainer],
  )

  return <div ref={refCallback} className={className} />
}

/**
 * Render inside any page to lift its primary action(s) into the header next to
 * the breadcrumb. Renders nothing inline; saves vertical space in the content.
 */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const { container } = useContext(PageHeaderActionsContext)

  if (!container) {
    return null
  }

  return createPortal(children, container)
}
