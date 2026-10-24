import { VisuallyHidden } from '@mantine/core'
import { ArrowLeftRight, Users } from 'lucide-react'
import { publishedReportTabs, type PublishedReportTab } from './publishedReportTabs'
import { workbookDisplayFileName } from '../../data/bug1274WorkbookGuide'
import { workbookIcon } from './workbookIcons'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { workbookDeskEntry } from '../../data/workbookDesk'

type Props = {
  compact?: boolean
  launches: readonly WorkbookLaunch[]
  active: string | null
  disabled: boolean
  published?: PublishedReportTab | null
  onOpenPublished?: (tab: PublishedReportTab) => void
  extra: ReactNode
  onOpen: (launch: WorkbookLaunch) => void
}

export function WorkbookSwitcher({ compact = false, launches, active, disabled, extra, onOpen, published, onOpenPublished }: Props) {
  const { t } = useI18n()
  return <nav className="workbook-switcher" aria-label={t('Звіти')}>
    {compact ? <><VisuallyHidden><h2>{t('Звіти')}</h2></VisuallyHidden>{extra}</> : <div className="workbook-switcher__toolbar">
      <h2 className="app-section-title workbook-switcher__title">{t('Звіти')}</h2>
      <div className="workbook-switcher__extra">{extra}</div>
    </div>}
    <div className="workbook-switcher__tabs app-screen-tabs">
      {launches.map(launch => {
        const current = launch.fileName === active
        const Icon = workbookIcon(launch.fileName, launch.dataset.DataSource)
        return <button key={launch.fileName} type="button" className={`app-screen-tab${current ? ' is-active' : ''}`}
          aria-current={current ? 'true' : undefined} disabled={disabled} title={workbookDisplayFileName(launch.fileName)}
          aria-label={t('Відкрити {file}', { file: workbookDisplayFileName(launch.fileName) })} onClick={() => { if (!current) onOpen(launch) }}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
          {t(workbookDeskEntry(launch.fileName)?.name ?? launch.label)}
        </button>
      })}
      {onOpenPublished ? publishedReportTabs.map(tab => {
        const current = published === tab.key, Icon = tab.key === 'movement' ? ArrowLeftRight : Users
        return <button key={tab.key} type="button" className={`app-screen-tab${current ? ' is-active' : ''}`}
          disabled={disabled} aria-current={current ? 'true' : undefined} onClick={() => { if (!current) onOpenPublished(tab.key) }}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />{t(tab.title)}
        </button>
      }) : null}
    </div>
  </nav>
}
