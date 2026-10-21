import { workbookDisplayFileName } from '../../data/bug1274WorkbookGuide'
import { workbookIcon } from './workbookIcons'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { workbookDeskEntry } from '../../data/workbookDesk'

type Props = {
  launches: readonly WorkbookLaunch[]
  active: string | null
  disabled: boolean
  extra: ReactNode
  onOpen: (launch: WorkbookLaunch) => void
}

export function WorkbookSwitcher({ launches, active, disabled, extra, onOpen }: Props) {
  const { t } = useI18n()
  return <nav className="workbook-switcher" aria-label={t('Звіти')}>
    <div className="workbook-switcher__toolbar">
      <h2 className="app-section-title workbook-switcher__title">{t('Звіти')}</h2>
      <div className="workbook-switcher__extra">{extra}</div>
    </div>
    <div className="workbook-switcher__tabs app-screen-tabs">
      {launches.map(launch => {
        const current = launch.fileName === active
        const Icon = workbookIcon(launch.fileName, launch.dataset.DataSource)
        return <button key={launch.fileName} type="button" className={`app-screen-tab${current ? ' is-active' : ''}`}
          aria-current={current ? 'true' : undefined} disabled={disabled} title={workbookDisplayFileName(launch.fileName)}
          aria-label={t('Відкрити {file}', { file: workbookDisplayFileName(launch.fileName) })} onClick={() => onOpen(launch)}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
          {t(workbookDeskEntry(launch.fileName)?.name ?? launch.label)}
        </button>
      })}
    </div>
  </nav>
}
