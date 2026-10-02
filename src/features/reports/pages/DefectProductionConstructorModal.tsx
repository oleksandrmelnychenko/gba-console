import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DefectProductionModalProps } from '../hooks/useDefectProductionConstructor'
import { DefectProductionReportPanel } from './DefectProductionReportPanel'

export function DefectProductionConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: DefectProductionModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити звіт браку') }}>
    {enabled && capability ? <DefectProductionReportPanel key={capability.SourceIdentity.SourceId} capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
