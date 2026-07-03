import { Anchor, Stack, Text } from '@mantine/core'
import { IconFileTypePdf } from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DebtorsDocumentResult } from '../types'
import './download-document-modal.css'

type DownloadDocumentModalProps = {
  opened: boolean
  document: DebtorsDocumentResult | null
  onClose: () => void
}

export function DownloadDocumentModal({ document, onClose, opened }: DownloadDocumentModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered className="sales-debtors-document-modal" opened={opened} title={<span className="sales-debtors-document-modal__title">{t('Документи')}</span>} onClose={onClose}>
      <Stack gap="sm">
        {document?.excelUrl || document?.pdfUrl ? (
          <>
            {document.excelUrl && (
              <Anchor href={document.excelUrl} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel')}</span>
              </Anchor>
            )}
            {document.pdfUrl && (
              <Anchor href={document.pdfUrl} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('Pdf')}</span>
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
