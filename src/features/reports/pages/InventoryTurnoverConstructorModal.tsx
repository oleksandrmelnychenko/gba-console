import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { InventoryTurnoverModalProps } from '../hooks/useInventoryTurnoverConstructor'
import { InventoryTurnoverReportPanel } from './InventoryTurnoverReportPanel'

export function InventoryTurnoverConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: InventoryTurnoverModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити звіт оборачуваності запасів') }}>
    {enabled && capability ? <InventoryTurnoverReportPanel key={capability.SourceIdentity.SourceId} capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
