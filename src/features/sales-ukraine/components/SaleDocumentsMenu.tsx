import { ActionIcon, Anchor, Button, Group, Menu, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileExcel, IconFileText, IconFileTypePdf } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  getSaleActForEditingHistoryDocument,
  getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument,
  getSalePaymentDocument,
  getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument,
} from '../api/salesUkraineApi'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'

type DocumentAction = {
  fetch: () => Promise<SaleDocumentResult>
  key: string
  label: string
}

type DocumentResultState = {
  label: string
  result: SaleDocumentResult
}

export function SaleDocumentsMenu({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const [resultState, setResultState] = useValueState<DocumentResultState | null>(null)

  const actions = useMemo(() => buildDocumentActions(sale, t), [sale, t])

  async function runAction(action: DocumentAction) {
    const notificationId = `sale-document-${action.key}`
    notifications.show({ id: notificationId, autoClose: false, loading: true, message: t('Формування документа') })

    try {
      const result = await action.fetch()

      if (result.excelUrl || result.pdfUrl) {
        notifications.update({ id: notificationId, autoClose: 1500, color: 'green', loading: false, message: t('Документ готовий') })
        setResultState({ label: action.label, result })
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
            {resultState.result.pdfUrl && (
              <Anchor href={resultState.result.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <IconFileTypePdf size={18} />
                  <Text>{t('Відкрити PDF')}</Text>
                </Group>
              </Anchor>
            )}
            {resultState.result.excelUrl && (
              <Anchor href={resultState.result.excelUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <IconFileExcel size={18} />
                  <Text>{t('Відкрити Excel')}</Text>
                </Group>
              </Anchor>
            )}
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

  const isPackaging = getLifecycleType(sale) === 1
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

    if (index === history.length - 1 && isVat) {
      actions.push({
        fetch: () => getSaleShipmentListHistoryDocument(netId, historyNetId),
        key: `shipment-history-${index}`,
        label: `${t('Лист на пакування')} (${t('правка')} ${index + 1})`,
      })
    }
  })

  if (isVat && withVatAccounting) {
    actions.push({ fetch: () => getSalePaymentDocument(netId), key: 'payment', label: t('Рахунок на оплату') })
  }

  return actions
}

function getLifecycleType(sale: SalesUkraineSale): number | null {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  return typeof status === 'number' ? status : null
}
