import { History } from 'lucide-react'
import { useInRouterContext, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../../shared/i18n/useI18n'

export const REPORT_HISTORY_ROUTE = '/reports/history'

export function ReportHistoryNavigationButton(props: { className: string; active: boolean; disabled: boolean }) {
  return useInRouterContext() ? <RoutedButton {...props} /> : null
}

function RoutedButton({ className, active, disabled }: { className: string; active: boolean; disabled: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return <button type="button" className={className} disabled={disabled} aria-pressed={active}
    onClick={() => { if (!active) navigate(REPORT_HISTORY_ROUTE) }}>
    <History size={16} aria-hidden="true" /><span>{t('Історія звітів')}</span>
  </button>
}
