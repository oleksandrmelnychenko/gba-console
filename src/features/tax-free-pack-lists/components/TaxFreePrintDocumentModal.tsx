import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { TaxFreePrintDocument } from '../types'

export function TaxFreePrintDocumentModal({
  document,
  onClose,
  title,
}: {
  document: TaxFreePrintDocument | null
  onClose: () => void
  title?: string
}) {
  const { t } = useI18n()

  return (
    <DocumentExportModal
      document={document}
      opened={Boolean(document)}
      title={title || t('Документи')}
      onClose={onClose}
    />
  )
}
