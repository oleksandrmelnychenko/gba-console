import { Fragment } from 'react'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import {
  PageHeaderActionsSlot,
  PageHeaderPanelActionsSlot,
} from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePageBreadcrumbLabel } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'

/**
 * Default page content-header strip rendered above every page's content frame:
 * the breadcrumb (module › node › active sub-tab) on the left and the page's
 * primary actions (lifted via {@link PageHeaderActions}) on the right.
 * Pages can append actions via PageHeaderActions and an extra crumb via
 * usePageBreadcrumb.
 */
export function ConsoleContentHeader() {
  const { selectedModule, selectedNode } = useNavigation()
  const pageCrumb = usePageBreadcrumbLabel()
  const crumbs = [selectedModule?.Module, selectedNode?.Module, pageCrumb].filter(
    (value): value is string => Boolean(value),
  )

  return (
    <div className="console-content-header">
      <div className="console-content-header-panel">
        <nav className="console-content-breadcrumbs" aria-label="breadcrumb">
          {crumbs.map((label, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <span className="console-content-crumb-sep" aria-hidden="true">
                  /
                </span>
              )}
              <span className={`console-content-crumb${index === crumbs.length - 1 ? ' is-current' : ''}`}>
                {label}
              </span>
            </Fragment>
          ))}
        </nav>
        <PageHeaderPanelActionsSlot className="console-content-header-panel-actions" />
      </div>
      <PageHeaderActionsSlot className="console-content-header-actions" />
    </div>
  )
}
