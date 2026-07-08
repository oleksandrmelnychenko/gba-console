import { Alert, Anchor, Stack, Text } from '@mantine/core'
import { CircleAlert, FileText } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
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
    <AppModal
      centered
      className="app-form-sheet"
      opened={opened}
      size="sm"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Друк PDF')}</span>}
      onClose={onClose}
    >
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
            {document.PdfDocumentURL && (
              <Anchor href={upgradeHttpToHttps(document.PdfDocumentURL)} target="_blank" rel="noreferrer">
                <Stack gap={2}>
                  <FileText size={22} strokeWidth={1.8} />
                  <Text size="sm">{t('PDF документ')}</Text>
                </Stack>
              </Anchor>
            )}
            {document.DocumentURL && (
              <Anchor href={upgradeHttpToHttps(document.DocumentURL)} target="_blank" rel="noreferrer">
                <Stack gap={2}>
                  <ExcelIcon size={22} />
                  <Text size="sm">{t('Excel документ')}</Text>
                </Stack>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}
