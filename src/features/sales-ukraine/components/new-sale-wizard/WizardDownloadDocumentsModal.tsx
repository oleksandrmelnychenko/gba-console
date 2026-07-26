import { UserRoleType } from '../../../../shared/auth/types'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  DocumentExportModal,
  type DocumentExportItem,
} from '../../../../shared/ui/document-export-modal/DocumentExportModal'
import { useAuth } from '../../../auth/useAuth'
import type { SaleDocumentResult } from '../../types'

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

  const items: DocumentExportItem[] = documents.flatMap((document) => [
    ...(document.excelUrl ? [{
      format: 'excel' as const,
      label: `${document.label} · Excel`,
      url: document.excelUrl,
    }] : []),
    ...(document.pdfUrl ? [{
      format: 'pdf' as const,
      label: `${document.label} · PDF`,
      url: document.pdfUrl,
    }] : []),
  ])

  return (
    <DocumentExportModal
      emptyText={t('Документи недоступні')}
      items={items}
      opened={Boolean(result)}
      title={t('Документи')}
      onClose={onClose}
    />
  )
}
