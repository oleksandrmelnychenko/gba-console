import { useI18n } from '../../../shared/i18n/useI18n'
import { ReportModal } from './ReportModal'
import type { EmployeeGrossProfitModalProps } from '../hooks/useEmployeeGrossProfitConstructor'
import { EmployeeGrossProfitReportPanel } from './EmployeeGrossProfitReportPanel'

export function EmployeeGrossProfitConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: EmployeeGrossProfitModalProps) {
  const { t } = useI18n()
  return <ReportModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити прибуток на співробітника') }}>
    {enabled && capability ? <EmployeeGrossProfitReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </ReportModal>
}
