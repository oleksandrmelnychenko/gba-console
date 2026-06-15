import { Button, Group, Stack, Text } from '@mantine/core'
import { UserRoleType } from '../../../../shared/auth/types'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import { useAuth } from '../../../auth/useAuth'
import type { SaleDocumentResult } from '../../types'
import { SaleDocumentDownloads } from '../SaleDocumentDownloads'

const INVOICE_DOCUMENT_ROLES: ReadonlyArray<UserRoleType> = [
  UserRoleType.GBA,
  UserRoleType.Administrator,
  UserRoleType.FinanceDirector,
  UserRoleType.Accountant,
]

type WizardDownloadDocument = {
  excelUrl: string | null
  label: string
  pdfUrl: string | null
}

export function WizardDownloadDocumentsModal({
  result,
  onClose,
}: {
  onClose: () => void
  result: SaleDocumentResult | null
}) {
  const { t } = useI18n()
  const { user } = useAuth()

  const roleType = user?.UserRole?.UserRoleType
  const isAbleToInvoiceDocument = roleType !== undefined && INVOICE_DOCUMENT_ROLES.includes(roleType)
  const documents: WizardDownloadDocument[] = []

  if (result) {
    documents.push({ excelUrl: result.excelUrl, label: t('Рахунок на оплату'), pdfUrl: result.pdfUrl })

    if (
      (result.isAcceptedToPacking || isAbleToInvoiceDocument) &&
      (result.invoiceExcelUrl || result.invoicePdfUrl)
    ) {
      documents.push({ excelUrl: result.invoiceExcelUrl, label: t('Видаткова накладна'), pdfUrl: result.invoicePdfUrl })
    }
  }

  return (
    <AppModal centered opened={Boolean(result)} size="sm" title={t('Документи')} onClose={onClose}>
      <Stack gap="sm">
        {documents.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Документи недоступні')}
          </Text>
        ) : (
          <SaleDocumentDownloads documents={documents} />
        )}
        <Group justify="flex-end" mt="xs">
          <Button color="violet" variant="subtle" onClick={onClose}>
            {t('Закрити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
