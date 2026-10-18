import { ArrowLeft } from 'lucide-react'
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
  onBack: () => void
}

export function WorkbookSwitcher({ launches, active, disabled, extra, onOpen, onBack }: Props) {
  const { t } = useI18n()
  return <nav className="workbook-switcher" aria-label={t('Звіти')}>
    <div className="workbook-switcher__toolbar">
      <button type="button" className="workbook-switcher__back" onClick={onBack}>
        <span className="workbook-switcher__back-icon"><ArrowLeft size={16} aria-hidden="true" /></span>
        {t('Усі звіти')}
      </button>
      <div className="workbook-switcher__extra">{extra}</div>
    </div>
    <div className="workbook-switcher__tabs pill-tabs">
      {launches.map(launch => {
        const current = launch.fileName === active
        return <button key={launch.fileName} type="button" className={`pill-tab${current ? ' is-active' : ''}`}
          aria-current={current ? 'true' : undefined} disabled={disabled} title={launch.fileName}
          aria-label={t('Відкрити {file}', { file: launch.fileName })} onClick={() => onOpen(launch)}>
          {t(workbookDeskEntry(launch.fileName)?.name ?? launch.label)}
        </button>
      })}
    </div>
  </nav>
}
