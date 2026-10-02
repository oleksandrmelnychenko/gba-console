import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { PlannedCashModalProps } from '../hooks/usePlannedCashConstructor'
import { PlannedCashReportPanel } from './PlannedCashReportPanel'

export function PlannedCashConstructorModal({ capability, enabled, generating, callerKey, initialFilters, onClose, onLoadingChange }: PlannedCashModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити звіт планування коштів') }}>
    {enabled && capability ? <PlannedCashReportPanel key={capability.SourceIdentity.SourceId} capability={capability} initialFilters={initialFilters}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
