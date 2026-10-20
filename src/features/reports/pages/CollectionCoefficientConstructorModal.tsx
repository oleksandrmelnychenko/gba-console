import { useI18n } from '../../../shared/i18n/useI18n'
import { ReportModal } from './ReportModal'
import type { CollectionCoefficientModalProps } from '../hooks/useCollectionCoefficientConstructor'
import { CollectionCoefficientReportPanel } from './CollectionCoefficientReportPanel'


export function CollectionCoefficientConstructorModal({ capability, enabled, generating, callerKey, initialMonth, onClose, onLoadingChange }: CollectionCoefficientModalProps) {
  const { t } = useI18n()
  return <ReportModal opened={enabled && capability !== null} title={capability?.Title ?? ''} size={960}
    onClose={onClose} closeOnClickOutside={!generating} closeOnEscape={!generating}
    closeButtonProps={{ disabled: generating, 'aria-label': t('Закрити конструктор коефіцієнта інкасації') }}>
    {enabled && capability ? <CollectionCoefficientReportPanel capability={capability}
      initialMonth={initialMonth} canGenerate={enabled} callerKey={callerKey} onLoadingChange={onLoadingChange} /> : null}
  </ReportModal>
}
