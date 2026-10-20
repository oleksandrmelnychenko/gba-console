import { useI18n } from '../../../shared/i18n/useI18n'
import { ReportModal } from './ReportModal'
import type { ManagementReturnsModalProps } from '../hooks/useManagementReturnsConstructor'
import { ManagementReturnsReportPanel } from './ManagementReturnsReportPanel'

export function ManagementReturnsConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: ManagementReturnsModalProps) {
  const { t } = useI18n()
  return <ReportModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити управлінські повернення') }}>
    {enabled && capability ? <ManagementReturnsReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </ReportModal>
}
