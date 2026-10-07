import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { SalesMarginModalProps } from '../hooks/useSalesMarginConstructor'
import { SalesMarginReportPanel } from './SalesMarginReportPanel'

export function SalesMarginConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: SalesMarginModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.Title ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити місячну маржу') }}>
    {enabled && capability ? <SalesMarginReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
