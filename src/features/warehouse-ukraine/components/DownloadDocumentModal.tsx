import { Alert, Anchor, Stack, Text } from '@mantine/core'
import { CircleAlert, FileText } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { AppModal } from '../../../shared/ui/AppModal'
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
    <AppModal centered opened={opened} title={t('Документи')} onClose={onClose}>
      <Stack gap="sm">
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : error ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Завантажити Excel')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <FileText size={22} strokeWidth={1.8} />
                </span>
                <span>{t('Завантажити PDF')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Немає документів для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}
