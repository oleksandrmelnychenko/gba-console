import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CashMovementModalProps } from '../hooks/useCashMovementConstructor'
import { CashMovementReportPanel } from './CashMovementReportPanel'

export function CashMovementConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: CashMovementModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.Title ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити рух коштів') }}>
    {enabled && capability ? <CashMovementReportPanel key={capability.SourceIdentity.SourceId} capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
