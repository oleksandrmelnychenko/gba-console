import { Fragment } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { PageHeaderActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePageBreadcrumbLabel } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'

/**
 * Default page content-header strip rendered above every page's content frame:
 * the breadcrumb (module › node › active sub-tab) on the left and the page's
 * primary actions (lifted via {@link PageHeaderActions}) on the right.
 * Pages that need a fully custom bar render their own via PageContentHeader;
 * this default is hidden for them (see layout.css `:has()` rule).
 */
export function ConsoleContentHeader() {
  const { selectedModule, selectedNode } = useNavigation()
  const pageCrumb = usePageBreadcrumbLabel()
  const crumbs = [selectedModule?.Module, selectedNode?.Module, pageCrumb].filter(
    (value): value is string => Boolean(value),
  )

  return (
    <div className="console-content-header">
      <nav className="console-content-breadcrumbs" aria-label="breadcrumb">
        {crumbs.map((label, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <IconChevronRight size={14} stroke={1.8} className="console-content-crumb-sep" aria-hidden="true" />
            )}
            <span className={`console-content-crumb${index === crumbs.length - 1 ? ' is-current' : ''}`}>
              {label}
            </span>
          </Fragment>
        ))}
      </nav>
      <PageHeaderActionsSlot className="console-content-header-actions" />
    </div>
  )
}
