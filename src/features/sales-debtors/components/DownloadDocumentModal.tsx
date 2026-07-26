import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { DebtorsDocumentResult } from '../types'

type DownloadDocumentModalProps = {
  opened: boolean
  document: DebtorsDocumentResult | null
  onClose: () => void
}

export function DownloadDocumentModal({ document, onClose, opened }: DownloadDocumentModalProps) {
  const { t } = useI18n()

  return (
    <DocumentExportModal
      excelUrl={document?.excelUrl}
      opened={opened}
      pdfUrl={document?.pdfUrl}
      title={t('Документи')}
      onClose={onClose}
    />
  )
}
