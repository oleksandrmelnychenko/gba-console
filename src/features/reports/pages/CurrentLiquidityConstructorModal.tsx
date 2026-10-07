import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CurrentLiquidityModalProps } from '../hooks/useCurrentLiquidityConstructor'
import { CurrentLiquidityReportPanel } from './CurrentLiquidityReportPanel'

export function CurrentLiquidityConstructorModal({ capability, enabled, generating, callerKey, initialEndpoints, onClose, onLoadingChange }: CurrentLiquidityModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={1100}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити звіт поточної ліквідності') }}>
    {enabled && capability ? <CurrentLiquidityReportPanel key={capability.SourceIdentity.SourceId} capability={capability} initialEndpoints={initialEndpoints}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
