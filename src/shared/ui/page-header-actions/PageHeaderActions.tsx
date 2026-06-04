import { useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderActionsContext } from './pageHeaderActionsContext'

/** Brand orange used for every "create new" call-to-action lifted into the header. */
export const CREATE_ACTION_COLOR = '#E8782E'

/**
 * Wraps the console shell so the header slot and the routed pages share one
 * portal target. Pages render their primary action via {@link PageHeaderActions}
 * and it teleports into {@link PageHeaderActionsSlot} placed in the header. Pages
 * may also append a trailing breadcrumb segment (e.g. the active sub-tab) via
 * {@link usePageBreadcrumb}.
 */
export function PageHeaderActionsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [contentHeaderContainer, setContentHeaderContainer] =
    useState<HTMLElement | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<string | null>(null)

  return (
    <PageHeaderActionsContext
      value={{
        container,
        contentHeaderContainer,
        setContainer,
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

/** Render once above the page content frame. Pages can portal compact page-level navigation here. */
export function PageContentHeaderSlot({ className }: { className?: string }) {
  const { setContentHeaderContainer } = useContext(PageHeaderActionsContext)
  const refCallback = useCallback(
    (element: HTMLDivElement | null) => setContentHeaderContainer(element),
    [setContentHeaderContainer],
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

/** Portals content into the page-level strip above the main content frame. */
export function PageContentHeader({ children }: { children: ReactNode }) {
  const { contentHeaderContainer } = useContext(PageHeaderActionsContext)

  if (!contentHeaderContainer) {
    return null
  }

  return createPortal(children, contentHeaderContainer)
}
