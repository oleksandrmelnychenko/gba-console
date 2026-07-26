import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { WarehouseUkraineExportDocument } from '../types'

type DownloadDocumentModalProps = {
  opened: boolean
  isLoading: boolean
  error: string | null
  document: WarehouseUkraineExportDocument | null
  onClose: () => void
}

export function DownloadDocumentModal({
  document,
  error,
  isLoading,
  onClose,
  opened,
}: DownloadDocumentModalProps) {
  const { t } = useI18n()

  return (
    <DocumentExportModal
      document={document}
      error={error}
      isLoading={isLoading}
      opened={opened}
      title={t('Документи')}
      onClose={onClose}
    />
  )
}
