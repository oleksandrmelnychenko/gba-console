import { useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderActionsContext } from './pageHeaderActionsContext'

/** Brand orange used for every "create new" call-to-action lifted into the header. */
export const CREATE_ACTION_COLOR = '#E8782E'

/**
 * Wraps the console shell so header slots and routed pages share portal
 * targets. Pages render their primary actions via {@link PageHeaderActions},
 * secondary panel actions via {@link PageHeaderPanelActions}, and may append a
 * trailing breadcrumb segment via {@link usePageBreadcrumb}.
 */
export function PageHeaderActionsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [panelActionsContainer, setPanelActionsContainer] =
    useState<HTMLElement | null>(null)
  const [contentHeaderContainer, setContentHeaderContainer] =
    useState<HTMLElement | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<string | null>(null)

  return (
    <PageHeaderActionsContext
      value={{
        container,
        panelActionsContainer,
        contentHeaderContainer,
        setContainer,
        setPanelActionsContainer,
        setContentHeaderContainer,
        breadcrumb,
        setBreadcrumb,
      }}
    >
      {children}
    </PageHeaderActionsContext>
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

/** Render exactly once in the breadcrumb panel - the destination for secondary header actions. */
export function PageHeaderPanelActionsSlot({ className }: { className?: string }) {
  const { setPanelActionsContainer } = useContext(PageHeaderActionsContext)
  const refCallback = useCallback(
    (element: HTMLDivElement | null) => setPanelActionsContainer(element),
    [setPanelActionsContainer],
  )

  return <div ref={refCallback} className={className} />
}

/** Render once above the page content frame. Pages can portal compact page-level navigation here. */
export function PageContentHeaderSlot({ className }: { className?: string }) {
  const { setContentHeaderContainer } = useContext(PageHeaderActionsContext)
  const refCallback = useCallback(
    (element: HTMLDivElement | null) => setContentHeaderContainer(element),
    [setContentHeaderContainer],
  )

  return <div ref={refCallback} className={className} />
}

/** Render inside any page to lift primary actions to the right of the header panel. */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const { container } = useContext(PageHeaderActionsContext)

  if (!container) {
    return null
  }

  return createPortal(children, container)
}

/** Lift secondary actions into the gray breadcrumb panel. */
export function PageHeaderPanelActions({ children }: { children: ReactNode }) {
  const { panelActionsContainer } = useContext(PageHeaderActionsContext)

  if (!panelActionsContainer) {
    return null
  }

  return createPortal(children, panelActionsContainer)
}

/** Portals content into the page-level strip above the main content frame. */
export function PageContentHeader({ children }: { children: ReactNode }) {
  const { contentHeaderContainer } = useContext(PageHeaderActionsContext)

  if (!contentHeaderContainer) {
    return null
  }

  return createPortal(children, contentHeaderContainer)
}
