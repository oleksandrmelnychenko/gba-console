import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { ClientProductMovementDocumentResult } from '../types'

export function DownloadDocumentModal({
  document,
  opened,
  title,
  onClose,
}: {
  document: ClientProductMovementDocumentResult | null
  onClose: () => void
  opened: boolean
  title: string
}) {
  return (
    <DocumentExportModal
      excelUrl={document?.excelUrl}
      opened={opened}
      pdfUrl={document?.pdfUrl}
      title={title}
      onClose={onClose}
    />
  )
}
