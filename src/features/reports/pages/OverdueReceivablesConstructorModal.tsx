import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { OverdueReceivablesModalProps } from '../hooks/useOverdueReceivablesConstructor'
import { OverdueReceivablesReportPanel } from './OverdueReceivablesReportPanel'

export function OverdueReceivablesConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: OverdueReceivablesModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити прострочену дебіторку') }}>
    {enabled && capability ? <OverdueReceivablesReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
