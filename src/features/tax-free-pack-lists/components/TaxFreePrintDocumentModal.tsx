import { Button, Group, Stack, Text } from '@mantine/core'
import { FileText } from 'lucide-react'
import { AppModal } from '../../../shared/ui/AppModal'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaxFreePrintDocument } from '../types'
import { hasTaxFreePrintDocumentUrl } from '../utils/taxFreePrintDocuments'

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
    <AppModal centered opened={Boolean(document)} size="sm" title={t('Документи')} onClose={onClose}>
      <Stack gap="sm">
        {title ? (
          <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)' }}>
            {title}
          </Text>
        ) : null}

        {hasTaxFreePrintDocumentUrl(document) ? (
          <Group gap="xs">
            {document?.DocumentURL ? (
              <Button
                color="teal"
                component="a"
                href={getDocumentHref(document.DocumentURL)}
                leftSection={<ExcelIcon size={18} />}
                rel="noopener noreferrer"
                target="_blank"
                variant="outline"
              >
                Excel
              </Button>
            ) : null}
            {document?.PdfDocumentURL ? (
              <Button
                color="red"
                component="a"
                href={getDocumentHref(document.PdfDocumentURL)}
                leftSection={<FileText size={16} />}
                rel="noopener noreferrer"
                target="_blank"
                variant="light"
              >
                PDF
              </Button>
            ) : null}
          </Group>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ не повернув посилання')}
          </Text>
        )}

        <Group justify="flex-end" mt="xs">
          <Button color="orange" variant="subtle" onClick={onClose}>
            {t('Закрити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
