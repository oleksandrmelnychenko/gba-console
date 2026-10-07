import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { SupplierDebtModalProps } from '../hooks/useSupplierDebtConstructor'
import { SupplierDebtReportPanel } from './SupplierDebtReportPanel'

export function SupplierDebtConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: SupplierDebtModalProps) {
  const { t } = useI18n()
  return <AppModal opened={enabled && capability !== null} title={capability?.ReportName ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити заборгованість постачальникам') }}>
    {enabled && capability ? <SupplierDebtReportPanel capability={capability} initialMonth={initialMonth}
      canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </AppModal>
}
