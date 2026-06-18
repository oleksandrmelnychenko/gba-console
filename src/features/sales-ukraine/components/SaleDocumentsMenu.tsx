import { ActionIcon, Button, Group, Menu, Stack, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileText } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { UserRoleType } from '../../../shared/auth/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { SaleDocumentDownloads } from './SaleDocumentDownloads'
import {
  getSaleActForEditingHistoryDocument,
  getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument,
  getSalePaymentDocument,
  getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument,
} from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'

type DocumentPart = {
  fetch: () => Promise<SaleDocumentResult>
  label: string
}

type DocumentAction = {
  bundlesInvoice?: boolean
  // A single document, or several documents bundled into one menu entry (fetched together,
  // client-side — no server change). `parts` takes precedence over `fetch`.
  fetch?: () => Promise<SaleDocumentResult>
  key: string
  label: string
  parts?: DocumentPart[]
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

const INVOICE_BUNDLE_ROLES: ReadonlyArray<UserRoleType> = [
  UserRoleType.Administrator,
  UserRoleType.GBA,
  UserRoleType.FinanceDirector,
  UserRoleType.Accountant,
]

export function SaleDocumentsMenu({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [resultState, setResultState] = useValueState<DocumentResultState | null>(null)

  const isAbleToInvoiceDocument = useMemo(() => {
    const roleType = user?.UserRole?.UserRoleType
    return roleType !== undefined && INVOICE_BUNDLE_ROLES.includes(roleType)
  }, [user])

  const actions = useMemo(() => buildDocumentActions(sale, t), [sale, t])

  async function runAction(action: DocumentAction) {
    const notificationId = `sale-document-${action.key}`
    notifications.show({ id: notificationId, autoClose: false, loading: true, message: t('Формування документа') })

    try {
      let documents: DocumentFile[]

      if (action.parts) {
        // Bundled entry: fetch every part in parallel and merge their files under one title.
        const settled = await Promise.all(
          action.parts.map((part) =>
            part
              .fetch()
              .then((result) => ({ label: part.label, result }))
              .catch(() => null),
          ),
        )

        documents = settled
          .filter((entry): entry is { label: string; result: SaleDocumentResult } => entry !== null)
          .flatMap((entry) => buildDocumentFiles({ key: action.key, label: entry.label }, entry.result, isAbleToInvoiceDocument, t))
      } else if (action.fetch) {
        const result = await action.fetch()
        documents = buildDocumentFiles(action, result, isAbleToInvoiceDocument, t)
      } else {
        documents = []
      }

      if (documents.length) {
        notifications.update({ id: notificationId, autoClose: 1500, color: 'green', loading: false, message: t('Документ готовий') })
        setResultState({ documents, label: action.label })
      } else {
        notifications.update({ id: notificationId, autoClose: 3000, color: 'orange', loading: false, message: t('Документ недоступний') })
      }
    } catch {
      notifications.update({ id: notificationId, autoClose: 3500, color: 'red', loading: false, message: t('Не вдалося сформувати документ') })
    }
  }

  return (
    <>
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <Tooltip label={t('Документи')}>
            <ActionIcon aria-label={t('Документи')} color="gray" variant="subtle">
              <IconFileText size={18} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          {actions.length ? (
            actions.map((action) => (
              <Menu.Item key={action.key} onClick={() => runAction(action)}>
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
              <Button color="violet" variant="subtle" onClick={() => setResultState(null)}>
                {t('Закрити')}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </>
  )
}

// Label for a bundled revision entry, e.g. "Правка 1 документа" / "Поточна правка документа".
function revisionDocumentsLabel(revision: number, isCurrent: boolean, t: (key: string) => string): string {
  if (isCurrent) {
    return `${t('Поточна')} ${t('правка документа')}`
  }

  return `${t('Правка')} ${revision} ${t('документа')}`
}

function buildDocumentActions(sale: SalesUkraineSale, t: (key: string) => string): DocumentAction[] {
  const netId = sale.NetUid

  if (!netId) {
    return []
  }

  const lifecycleStatusKey = getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
  const isPackaging = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'
  const hasTransporter = Boolean(sale.TransporterId)
  const isVat = Boolean(sale.IsVatSale)
  const withVatAccounting = Boolean(sale.ClientAgreement?.Agreement?.WithVATAccounting)
  const history = Array.isArray(sale.HistoryInvoiceEdit) ? sale.HistoryInvoiceEdit : []
  const hasHistory = history.length > 0
  const actions: DocumentAction[] = []

  if (hasTransporter && isPackaging) {
    if (hasHistory) {
      // Revision 1 = the base documents — bundled into one "Перша правка документів" entry.
      const parts: DocumentPart[] = [{ fetch: () => getSaleInvoiceDocument(netId), label: t('Видаткова накладна') }]

      if (isVat) {
        parts.push({ fetch: () => getSaleShipmentListDocument(netId), label: t('Лист на пакування') })
      }

      actions.push({ key: 'revision-1', label: revisionDocumentsLabel(1, false, t), parts })
    } else {
      // No edits yet — just the current invoice (+ shipment for VAT).
      actions.push({ fetch: () => getSaleInvoiceDocument(netId), key: 'invoice', label: t('Видаткова накладна') })

      if (isVat) {
        actions.push({ fetch: () => getSaleShipmentListDocument(netId), key: 'shipment', label: t('Лист на пакування') })
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

    actions.push({ key: `revision-${revision}`, label: revisionDocumentsLabel(revision, isLast, t), parts })
  })

  if (isVat && withVatAccounting) {
    actions.push({ bundlesInvoice: true, fetch: () => getSalePaymentDocument(netId), key: 'payment', label: t('Рахунок на оплату') })
  }

  return actions
}

function buildDocumentFiles(
  action: DocumentAction,
  result: SaleDocumentResult,
  isAbleToInvoiceDocument: boolean,
  t: (key: string) => string,
): DocumentFile[] {
  const documents: DocumentFile[] = []

  if (result.excelUrl || result.pdfUrl) {
    documents.push({ excelUrl: result.excelUrl, label: action.label, pdfUrl: result.pdfUrl })
  }

  if (action.bundlesInvoice && (result.isAcceptedToPacking || isAbleToInvoiceDocument)) {
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
