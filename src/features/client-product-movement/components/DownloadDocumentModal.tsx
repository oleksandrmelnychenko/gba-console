import { Anchor, Group, Stack, Text } from '@mantine/core'
import { IconFileTypePdf } from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
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
  const { t } = useI18n()
  const excelUrl = document?.excelUrl ?? null
  const pdfUrl = document?.pdfUrl ?? null

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="sm">
        {excelUrl || pdfUrl ? (
          <>
            {excelUrl && (
              <Anchor href={excelUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <ExcelIcon size={20} />
                  <Text>{t('Excel документ')}</Text>
                </Group>
              </Anchor>
            )}
            {pdfUrl && (
              <Anchor href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <IconFileTypePdf size={20} />
                  <Text>{t('PDF документ')}</Text>
                </Group>
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
