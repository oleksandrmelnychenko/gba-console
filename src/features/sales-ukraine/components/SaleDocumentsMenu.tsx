import { ActionIcon, Anchor, Button, Divider, Group, Menu, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileExcel, IconFileText, IconFileTypePdf } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { UserRoleType } from '../../../shared/auth/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  getSaleActForEditingHistoryDocument,
  getSaleActProtocolEditDocument,
  getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument,
  getSalePaymentDocument,
  getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument,
} from '../api/salesUkraineApi'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'

type DocumentAction = {
  bundlesInvoice?: boolean
  fetch: () => Promise<SaleDocumentResult>
  key: string
  label: string
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
      const result = await action.fetch()
      const documents = buildDocumentFiles(action, result, isAbleToInvoiceDocument, t)

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
        title={resultState?.label || t('Документи')}
        onClose={() => setResultState(null)}
      >
        {resultState && (
          <Stack gap="sm">
            {resultState.documents.map((document, index) => (
              <Stack key={`${document.label}-${index}`} gap="xs">
                {resultState.documents.length > 1 && (
                  <>
                    {index > 0 && <Divider />}
                    <Text fw={600} size="sm">
                      {document.label}
                    </Text>
                  </>
                )}
                {document.pdfUrl && (
                  <Anchor href={document.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Group gap="xs">
                      <IconFileTypePdf size={18} />
                      <Text>{t('Відкрити PDF')}</Text>
                    </Group>
                  </Anchor>
                )}
                {document.excelUrl && (
                  <Anchor href={document.excelUrl} target="_blank" rel="noopener noreferrer">
                    <Group gap="xs">
                      <IconFileExcel size={18} />
                      <Text>{t('Відкрити Excel')}</Text>
                    </Group>
                  </Anchor>
                )}
              </Stack>
            ))}
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setResultState(null)}>
                {t('Закрити')}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </>
  )
}

function buildDocumentActions(sale: SalesUkraineSale, t: (key: string) => string): DocumentAction[] {
  const netId = sale.NetUid

  if (!netId) {
    return []
  }

  const lifecycleType = getLifecycleType(sale)
  const isPackaging = lifecycleType === 1 || lifecycleType === 2
  const hasTransporter = Boolean(sale.TransporterId)
  const isVat = Boolean(sale.IsVatSale)
  const withVatAccounting = Boolean(sale.ClientAgreement?.Agreement?.WithVATAccounting)
  const history = Array.isArray(sale.HistoryInvoiceEdit) ? sale.HistoryInvoiceEdit : []
  const actions: DocumentAction[] = []

  if (hasTransporter && isPackaging) {
    actions.push({ fetch: () => getSaleInvoiceDocument(netId), key: 'invoice', label: t('Видаткова накладна') })

    if (isVat) {
      actions.push({ fetch: () => getSaleShipmentListDocument(netId), key: 'shipment', label: t('Лист на пакування') })
    }
  }

  history.forEach((item, index) => {
    const historyNetId = item.NetUid

    if (!historyNetId) {
      return
    }

    actions.push({
      fetch: () => getSaleInvoiceHistoryDocument(netId, historyNetId),
      key: `invoice-history-${index}`,
      label: `${t('Видаткова накладна')} (${t('правка')} ${index + 1})`,
    })
    actions.push({
      fetch: () => getSaleActForEditingHistoryDocument(netId, historyNetId),
      key: `act-history-${index}`,
      label: `${t('Акт редагування')} ${index + 1}`,
    })

    if (index === history.length - 1) {
      actions.push({
        fetch: () => getSaleActProtocolEditDocument(netId),
        key: 'act-protocol-edit-current',
        label: t('Акт редагування (поточний)'),
      })
    }

    if (index === history.length - 1 && isVat) {
      actions.push({
        fetch: () => getSaleShipmentListHistoryDocument(netId, historyNetId),
        key: `shipment-history-${index}`,
        label: `${t('Лист на пакування')} (${t('правка')} ${index + 1})`,
      })
    }
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

function getLifecycleType(sale: SalesUkraineSale): number | null {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  return typeof status === 'number' ? status : null
}
