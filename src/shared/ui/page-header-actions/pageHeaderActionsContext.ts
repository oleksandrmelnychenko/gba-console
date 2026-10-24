import { createContext, useContext, useEffect } from 'react'

export type PageHeaderActionsContextValue = {
  container: HTMLElement | null
  panelActionsContainer: HTMLElement | null
  contentHeaderContainer: HTMLElement | null
  submenuContainer: HTMLElement | null
  setSubmenuContainer: (element: HTMLElement | null) => void
  titleContainer: HTMLElement | null
  setContainer: (element: HTMLElement | null) => void
  setPanelActionsContainer: (element: HTMLElement | null) => void
  setContentHeaderContainer: (element: HTMLElement | null) => void
  setTitleContainer: (element: HTMLElement | null) => void
  breadcrumb: string | null
  setBreadcrumb: (label: string | null) => void
}

export const PageHeaderActionsContext =
  createContext<PageHeaderActionsContextValue>({
    container: null,
    panelActionsContainer: null,
    contentHeaderContainer: null,
    submenuContainer: null,
    setSubmenuContainer: () => {},
    titleContainer: null,
    setContainer: () => {},
    setPanelActionsContainer: () => {},
    setContentHeaderContainer: () => {},
    setTitleContainer: () => {},
    breadcrumb: null,
    setBreadcrumb: () => {},
  })

/**
 * Append a trailing breadcrumb segment (e.g. the active sub-tab) for the
 * current screen. The segment is shown after the module/node crumbs in the
 * header and cleared automatically on unmount.
 */
export function usePageBreadcrumb(label: string | null) {
  const { setBreadcrumb } = useContext(PageHeaderActionsContext)

  useEffect(() => {
    setBreadcrumb(label)

    return () => setBreadcrumb(null)
  }, [label, setBreadcrumb])
}

/** Read the current trailing breadcrumb segment (used by the header). */
export function usePageBreadcrumbLabel() {
  return useContext(PageHeaderActionsContext).breadcrumb
}
