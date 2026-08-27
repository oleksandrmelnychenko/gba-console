import { Group } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import type {
  ReSale,
  ResaleDownloadDocumentType,
} from '../types'
import { ResaleDownloadDocumentType as DocumentType } from '../types'

export function ResaleRowActions({
  exportingKey,
  removingNetId,
  resale,
  onDelete,
  onExport,
  onOpenConsignmentNote,
}: {
  exportingKey: string | null
  removingNetId: string | null
  resale: ReSale
  onDelete?: (resale: ReSale) => void
  onExport?: (resale: ReSale, type: ResaleDownloadDocumentType) => void
  onOpenConsignmentNote?: (resale: ReSale) => void
}) {
  const { t } = useI18n()
  const isInvoice = Boolean(resale.ChangedToInvoice)
  const isDraft = !isInvoice && !resale.IsCompleted

  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      {onExport && (
        <TableRowAction
          action="download"
          disabled={!resale.NetUid}
          label={t('Платіжний документ')}
          loading={exportingKey === `${resale.NetUid}:${DocumentType.PaymentDocument}`}
          onClick={() => onExport(resale, DocumentType.PaymentDocument)}
        />
      )}
      {isInvoice && onExport && (
        <TableRowAction
          action="download"
          disabled={!resale.NetUid}
          label={t('Інвойс')}
          loading={exportingKey === `${resale.NetUid}:${DocumentType.SalesInvoice}`}
          onClick={() => onExport(resale, DocumentType.SalesInvoice)}
        />
      )}
      {isInvoice && onOpenConsignmentNote && (
        <TableRowAction
          action="delivery"
          disabled={!resale.NetUid}
          label={t('ТТН')}
          onClick={() => onOpenConsignmentNote(resale)}
        />
      )}
      {isDraft && onDelete && (
        <TableRowAction
          action="delete"
          disabled={!resale.NetUid || removingNetId === resale.NetUid}
          label={t('Видалити')}
          loading={removingNetId === resale.NetUid}
          onClick={() => onDelete(resale)}
        />
      )}
      <TableRowAction
        action="open"
        component={Link}
        label={t('Відкрити')}
        to={`/resales/${resale.NetUid || ''}`}
      />
    </Group>
  )
}
