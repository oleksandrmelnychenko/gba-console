import { Button, Group, Menu, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ClipboardList, FileText, Printer, Receipt } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { usePermissions } from '../../auth/usePermissions'
import { getApiLanguage } from '../../../shared/api/apiClient'
import { PermissionKeys, type SalesUkraineSalePermissionKey } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { SaleDocumentDownloads } from './SaleDocumentDownloads'
import {
  getSaleActForEditingHistoryDocument,
  getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument,
  getSalePaymentDocument,
  getSalePzDocument,
  getSaleRevisionBaseInvoiceDocument,
  getSaleRevisionBaseShipmentListDocument,
  getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument,
} from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import type { SalesMutationOperationOptions } from '../salesMutationOperation'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'
import { usePersistentSaleJsonMutationRunner } from '../usePersistentSaleJsonMutation'

type DocumentPart = {
  fetch: () => Promise<SaleDocumentResult>
  label: string
}

type DocumentAction = {
  bundlesInvoice?: boolean
  // A single document, or several documents bundled into one menu entry (fetched together,
  // client-side — no server change). `parts` takes precedence over `fetch`.
  fetch?: (operation?: SalesMutationOperationOptions) => Promise<SaleDocumentResult>
  key: string
  label: string
  parts?: DocumentPart[]
  permissionKey: SalesUkraineSalePermissionKey
  requiresOperationId?: boolean
}

type DocumentFile = {
  excelUrl: string | null
  label: string
  pdfUrl: string | null
}

type DocumentResultState = {
  documents: DocumentFile[]
  label: string
}

export type SaleDocumentsMenuAnchor = {
  left: number
  top: number
}

export function SaleDocumentsMenu({
  anchor,
  opened,
  sale,
  onMenuClose,
}: {
  anchor?: SaleDocumentsMenuAnchor | null
  opened?: boolean
  sale: SalesUkraineSale | null
  onMenuClose?: () => void
}) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const [resultState, setResultState] = useValueState<DocumentResultState | null>(null)
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null)
  const runningActionRef = useRef(false)
  const runPaymentDocumentMutation = usePersistentSaleJsonMutationRunner('sale-payment-document')

  const canExportInvoice = can(PermissionKeys.SalesUkraine.Sale.ExportInvoice)

  const apiLanguage = getApiLanguage()
  const actions = useMemo(
    () => (sale ? buildDocumentActions(sale, apiLanguage, t).filter((action) => can(action.permissionKey)) : []),
    [apiLanguage, can, sale, t],
  )
  const isControlled = typeof opened === 'boolean'

  async function runAction(action: DocumentAction) {
    const currentSale = sale

    if (!currentSale || !can(action.permissionKey) || runningActionRef.current) {
      return
    }

    runningActionRef.current = true
    setRunningActionKey(action.key)

    const notificationId = `sale-document-${action.key}`
    notifications.show({ id: notificationId, autoClose: false, loading: true, message: t('Формування документа') })

    try {
      let documents: DocumentFile[]

      if (action.parts) {
        // Bundled entry: fetch every part in parallel and merge their files under one title.
        const settled = await Promise.allSettled(
          action.parts.map((part) => part.fetch().then((result) => ({ label: part.label, result }))),
        )

        documents = settled.flatMap((entry) =>
          entry.status === 'fulfilled'
            ? buildDocumentFiles({ key: action.key, label: entry.value.label }, entry.value.result, canExportInvoice, t)
            : [],
        )

        if (!documents.length) {
          const failedPart = settled.find((entry): entry is PromiseRejectedResult => entry.status === 'rejected')

          if (failedPart) {
            throw failedPart.reason
          }
        }
      } else if (action.fetch) {
        const result = action.requiresOperationId
          ? await runPaymentDocumentAction(currentSale, action, runPaymentDocumentMutation)
          : await action.fetch()
        documents = buildDocumentFiles(action, result, canExportInvoice, t)
      } else {
        documents = []
      }

      if (documents.length) {
        notifications.update({ id: notificationId, autoClose: 1500, color: 'green', loading: false, message: t('Документ готовий') })
        setResultState({ documents, label: action.label })
      } else {
        notifications.update({ id: notificationId, autoClose: 3000, color: 'orange', loading: false, message: t('Документ недоступний') })
      }
    } catch (error) {
      const fallbackMessage = t('Не вдалося сформувати документ')
      const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage

      notifications.update({ id: notificationId, autoClose: 3500, color: 'red', loading: false, message })
    } finally {
      runningActionRef.current = false
      setRunningActionKey(null)
    }
  }

  if (!actions.length) {
    return null
  }

  return (
    <>
      <Menu
        opened={isControlled ? opened : undefined}
        position="bottom-end"
        shadow="md"
        withinPortal
        onChange={(nextOpened) => {
          if (isControlled && !nextOpened) {
            onMenuClose?.()
          }
        }}
      >
        <Menu.Target>
          {isControlled ? (
            <span
              aria-hidden="true"
              style={{
                height: 1,
                left: anchor?.left ?? -10_000,
                pointerEvents: 'none',
                position: 'fixed',
                top: anchor?.top ?? -10_000,
                width: 1,
              }}
            />
          ) : (
            <TableRowAction action="document" label={t('Документи')} />
          )}
        </Menu.Target>
        <Menu.Dropdown>
          {actions.length ? (
            actions.map((action) => (
              <Menu.Item
                key={action.key}
                disabled={runningActionKey !== null}
                leftSection={documentActionIcon(action.key)}
                onClick={() => runAction(action)}
              >
                {action.label}
              </Menu.Item>
            ))
          ) : (
            <Menu.Item disabled>{t('Документи недоступні')}</Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      <AppModal
        centered
        opened={Boolean(resultState)}
        size="sm"
        title={t('Документи')}
        onClose={() => setResultState(null)}
      >
        {resultState && (
          <Stack gap="sm">
            <SaleDocumentDownloads documents={resultState.documents} />
            <Group justify="flex-end" mt="xs">
              <Button color="orange" variant="subtle" onClick={() => setResultState(null)}>
                {t('Закрити')}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </>
  )
}

async function runPaymentDocumentAction(
  sale: SalesUkraineSale,
  action: DocumentAction,
  runMutation: ReturnType<typeof usePersistentSaleJsonMutationRunner>,
): Promise<SaleDocumentResult> {
  const netUid = sale.NetUid?.trim()
  const fetchDocument = action.fetch

  if (!netUid) {
    throw new Error('Продаж не має збереженого ідентифікатора')
  }

  if (!fetchDocument) {
    throw new Error('Документ недоступний')
  }

  const normalizedNetUid = netUid.toLowerCase()
  const attempt = await runMutation(
    `sale-payment-document:${normalizedNetUid}`,
    { NetUid: normalizedNetUid },
    (_payload, operation) => fetchDocument(operation),
  )

  if (!attempt.completed) {
    throw attempt.error
  }

  return attempt.result
}

// Monochrome (grey) icon per document type — kept neutral, not the brand colour.
function documentActionIcon(key: string) {
  const color = 'var(--mantine-color-gray-6)'

  if (key === 'shipment') {
    return <ClipboardList size={16} color={color} />
  }

  if (key === 'payment') {
    return <Receipt size={16} color={color} />
  }

  if (key === 'pz') {
    return <Printer size={16} color={color} />
  }

  return <FileText size={16} color={color} />
}

// Label for a bundled revision entry, e.g. "Правка 1 документа" / "Поточна правка документа".
function revisionDocumentsLabel(revision: number, isCurrent: boolean, t: (key: string) => string): string {
  if (isCurrent) {
    return `${t('Поточна')} ${t('правка документа')}`
  }

  return `${t('Правка')} ${revision} ${t('документа')}`
}

function buildDocumentActions(sale: SalesUkraineSale, apiLanguage: string, t: (key: string) => string): DocumentAction[] {
  const netId = sale.NetUid

  if (!netId) {
    return []
  }

  const lifecycleStatusKey = getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
  const isPackaging = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'
  const isInvoiceStatus = lifecycleStatusKey === 'Packaging'
  const isPaymentBillStatus = lifecycleStatusKey === 'New'
  const isPolishRegion = apiLanguage.toLowerCase() === 'pl'
  const hasTransporter = Boolean(sale.TransporterId)
  const isVat = Boolean(sale.IsVatSale)
  const withVatAccounting = Boolean(sale.ClientAgreement?.Agreement?.WithVATAccounting)
  const hasPrintedPaymentInvoice = Boolean(sale.IsPrintedPaymentInvoice)
  const history = Array.isArray(sale.HistoryInvoiceEdit) ? sale.HistoryInvoiceEdit : []
  const hasHistory = history.length > 0
  const actions: DocumentAction[] = []

  if (hasTransporter && isPackaging) {
    if (hasHistory) {
      // Revision 1 = the base documents — bundled into one "Перша правка документів" entry.
      const parts: DocumentPart[] = [{ fetch: () => getSaleRevisionBaseInvoiceDocument(netId), label: t('Видаткова накладна') }]

      if (isVat) {
        parts.push({ fetch: () => getSaleRevisionBaseShipmentListDocument(netId), label: t('Лист на пакування') })
      }

      actions.push({
        key: 'revision-1',
        label: revisionDocumentsLabel(1, false, t),
        parts,
        permissionKey: PermissionKeys.SalesUkraine.Sale.ExportRevisionDocuments,
      })
    } else {
      // No edits yet — just the current invoice (+ shipment for VAT).
      actions.push({
        fetch: () => getSaleInvoiceDocument(netId),
        key: 'invoice',
        label: t('Видаткова накладна'),
        permissionKey: PermissionKeys.SalesUkraine.Sale.ExportInvoice,
      })

      if (isVat) {
        actions.push({
          fetch: () => getSaleShipmentListDocument(netId),
          key: 'shipment',
          label: t('Лист на пакування'),
          permissionKey: PermissionKeys.SalesUkraine.Sale.ExportShipmentList,
        })
      }
    }
  }

  // Each HistoryInvoiceEdit entry is one revision; bundle ALL of its documents into a single
  // "N-та правка документів" entry (consistent with revision 1). The LAST entry is the current one.
  history.forEach((item, index) => {
    const historyNetId = item.NetUid

    if (!historyNetId) {
      return
    }

    const isLast = index === history.length - 1
    const revision = index + 2
    const parts: DocumentPart[] = [
      { fetch: () => getSaleInvoiceHistoryDocument(netId, historyNetId), label: t('Видаткова накладна') },
      { fetch: () => getSaleActForEditingHistoryDocument(netId, historyNetId), label: t('Акт редагування') },
    ]

    if (isLast && isVat) {
      parts.push({ fetch: () => getSaleShipmentListHistoryDocument(netId, historyNetId), label: t('Лист на пакування') })
    }

    actions.push({
      key: `revision-${revision}`,
      label: revisionDocumentsLabel(revision, isLast, t),
      parts,
      permissionKey: PermissionKeys.SalesUkraine.Sale.ExportRevisionDocuments,
    })
  })

  if (isPaymentBillStatus || hasPrintedPaymentInvoice || (isVat && withVatAccounting)) {
    actions.push({
      bundlesInvoice: true,
      fetch: (operation) => getSalePaymentDocument(netId, operation),
      key: 'payment',
      label: t('Рахунок на оплату'),
      permissionKey: PermissionKeys.SalesUkraine.Sale.ExportPaymentInvoice,
      requiresOperationId: true,
    })
  }

  if (isPolishRegion && isInvoiceStatus) {
    actions.push({
      fetch: () => getSalePzDocument(netId),
      key: 'pz',
      label: t('PZ'),
      permissionKey: PermissionKeys.SalesUkraine.Sale.ExportPz,
    })
  }

  return actions
}

function buildDocumentFiles(
  action: Pick<DocumentAction, 'bundlesInvoice' | 'key' | 'label'>,
  result: SaleDocumentResult,
  canExportInvoice: boolean,
  t: (key: string) => string,
): DocumentFile[] {
  const documents: DocumentFile[] = []

  if (result.excelUrl || result.pdfUrl) {
    documents.push({ excelUrl: result.excelUrl, label: action.label, pdfUrl: result.pdfUrl })
  }

  if (action.bundlesInvoice && (result.isAcceptedToPacking || canExportInvoice)) {
    if (result.invoiceExcelUrl || result.invoicePdfUrl) {
      documents.push({
        excelUrl: result.invoiceExcelUrl,
        label: t('Видаткова накладна'),
        pdfUrl: result.invoicePdfUrl,
      })
    }
  }

  return documents
}
