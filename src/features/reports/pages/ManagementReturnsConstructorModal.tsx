import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { ManagementReturnsModalProps } from '../hooks/useManagementReturnsConstructor'
import { ManagementReturnsReportPanel } from './ManagementReturnsReportPanel'

export function ManagementReturnsConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: ManagementReturnsModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити управлінські повернення') }}>
    {enabled && capability ? <ManagementReturnsReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
