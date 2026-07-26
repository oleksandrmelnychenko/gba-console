import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { SpecificationDownloadDocument } from '../specificationTypes'

type SpecificationDownloadModalProps = {
  document: SpecificationDownloadDocument | null
  error: string | null
  isLoading: boolean
  opened: boolean
  onClose: () => void
}

export function SpecificationDownloadModal({
  document,
  error,
  isLoading,
  opened,
  onClose,
}: SpecificationDownloadModalProps) {
  const { t } = useI18n()

  return (
    <DocumentExportModal
      document={document}
      error={error}
      isLoading={isLoading}
      opened={opened}
      title={t('Друк PDF')}
      onClose={onClose}
    />
  )
}
