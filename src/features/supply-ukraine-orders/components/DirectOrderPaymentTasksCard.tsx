import { Alert, Card, Group, Loader, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PaymentDeliveryProtocolsSection } from '../../supply-ukraine-payment-protocols/components/PaymentDeliveryProtocolsSection'
import type {
  NewPaymentProtocolFormValues,
  ProtocolUser,
  SupplyOrderUkrainePaymentDeliveryProtocol,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
} from '../../supply-ukraine-payment-protocols/types'
import {
  getSupplyInvoiceItems,
  getSupplyPaymentDeliveryProtocolKeys,
  getSupplyProtocolResponsibleUsers,
  updateSupplyInvoice,
} from '../api/supplyUkraineOrdersApi'
import type {
  DirectSupplyOrder,
  SupplyInformationDeliveryProtocol,
  SupplyInvoice,
  SupplyOrderPaymentDeliveryProtocol,
  SupplyOrderPaymentDeliveryProtocolKey,
  User,
} from '../types'

/**
 * «Платіжні задачі» block for the direct-order detail page — the legacy «Платіжні задачі»
 * section ported here. On the direct order, payment delivery protocols live on the order's
 * INVOICE (there is no order-level protocol field), so this block loads the order's invoice
 * (the same loader/save endpoint the «Інвойси і пак листи» page uses), renders the shared
 * PaymentDeliveryProtocolsSection (list + create + delete), and persists via /supplies/invoices/update.
 */
export function DirectOrderPaymentTasksCard({
  canEdit,
  onError,
  order,
}: {
  canEdit: boolean
  onError?: (message: string) => void
  order: DirectSupplyOrder
}) {
  const { t } = useI18n()
  const invoices = useMemo(() => order.SupplyInvoices || [], [order.SupplyInvoices])
  const [selectedInvoiceNetId, setSelectedInvoiceNetId] = useValueState<string | null>(invoices[0]?.NetUid || null)
  const [invoice, setInvoice] = useValueState<SupplyInvoice | null>(null)
  const [protocolKeys, setProtocolKeys] = useValueState<SupplyOrderPaymentDeliveryProtocolKey[]>([])
  const [users, setUsers] = useValueState<User[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setLocalError] = useValueState<string | null>(null)

  const reportError = useCallback((cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback
    setLocalError(message)
    onError?.(message)
  }, [onError, setLocalError])

  // Keep the selected invoice valid as the order reloads.
  useEffect(() => {
    setSelectedInvoiceNetId((current) =>
      invoices.some((entry) => entry.NetUid === current) ? current : invoices[0]?.NetUid || null,
    )
  }, [invoices, setSelectedInvoiceNetId])

  // Protocol-type keys + responsible users (loaded once).
  useEffect(() => {
    let cancelled = false

    async function loadMeta() {
      try {
        const [nextKeys, nextUsers] = await Promise.all([
          getSupplyPaymentDeliveryProtocolKeys(),
          getSupplyProtocolResponsibleUsers(),
        ])

        if (!cancelled) {
          setProtocolKeys(nextKeys)
          setUsers(nextUsers)
        }
      } catch (cause) {
        if (!cancelled) {
          reportError(cause, t('Не вдалося завантажити дані'))
        }
      }
    }

    void loadMeta()

    return () => {
      cancelled = true
    }
  }, [reportError, setProtocolKeys, setUsers, t])

  // Full invoice (with its payment protocols) for the selected invoice.
  useEffect(() => {
    if (!selectedInvoiceNetId) {
      setInvoice(null)
      return
    }

    let cancelled = false

    async function loadInvoice(netId: string) {
      setLoading(true)
      setLocalError(null)

      try {
        const loaded = await getSupplyInvoiceItems(netId)

        if (!cancelled) {
          setInvoice(loaded)
        }
      } catch (cause) {
        if (!cancelled) {
          reportError(cause, t('Не вдалося завантажити інвойс'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvoice(selectedInvoiceNetId)

    return () => {
      cancelled = true
    }
  }, [reportError, selectedInvoiceNetId, setInvoice, setLoading, setLocalError, t])

  async function persistInvoice(nextInvoice: SupplyInvoice): Promise<void> {
    if (!order.NetUid) {
      return
    }

    setSaving(true)
    setLocalError(null)

    try {
      await updateSupplyInvoice(order.NetUid, createInvoiceProtocolsPayload(nextInvoice))
      const reloaded = await getSupplyInvoiceItems(nextInvoice.NetUid || selectedInvoiceNetId || '')
      setInvoice(reloaded)
    } catch (cause) {
      reportError(cause, t('Не вдалося зберегти протоколи'))
      throw cause
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(values: NewPaymentProtocolFormValues): Promise<void> {
    if (!invoice) {
      return
    }

    await persistInvoice(addPaymentProtocol(invoice, values))
  }

  async function handleRemove(protocol: SupplyOrderUkrainePaymentDeliveryProtocol): Promise<void> {
    if (!invoice) {
      return
    }

    await persistInvoice(removePaymentProtocol(invoice, protocol.NetUid, protocol.Id))
  }

  const displayProtocols = mapToDisplayProtocols(invoice)
  const totalGrossPriceLocal = Number(order.TotalNetPrice) || Number(order.NetPrice) || 0

  return (
    <Card className="supply-detail-card" withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Платіжні задачі')}
        </Text>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {invoices.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Спочатку створіть інвойс для замовлення')}
          </Text>
        ) : (
          <>
            {invoices.length > 1 && (
              <Select
                data={invoices.map((entry) => ({ value: entry.NetUid || '', label: entry.Number || entry.NetUid || '' }))}
                label={t('Інвойс')}
                value={selectedInvoiceNetId}
                w={260}
                onChange={(value) => setSelectedInvoiceNetId(value)}
              />
            )}

            {isLoading ? (
              <Group justify="center" py="md">
                <Loader size="sm" />
              </Group>
            ) : (
              <PaymentDeliveryProtocolsSection
                canCreateProtocol={canEdit}
                canRemoveProtocol={canEdit}
                isSaving={isSaving}
                onCreateProtocol={handleCreate}
                onRemoveProtocol={handleRemove}
                protocolKeys={protocolKeys as unknown as SupplyOrderUkrainePaymentDeliveryProtocolKey[]}
                protocols={displayProtocols}
                totalGrossPriceLocal={totalGrossPriceLocal}
                users={users as unknown as ProtocolUser[]}
              />
            )}
          </>
        )}
      </Stack>
    </Card>
  )
}

/** Map the direct-order invoice protocols into the shape PaymentDeliveryProtocolsSection renders. */
function mapToDisplayProtocols(invoice: SupplyInvoice | null): SupplyOrderUkrainePaymentDeliveryProtocol[] {
  const displayProtocols: SupplyOrderUkrainePaymentDeliveryProtocol[] = []

  for (const protocol of invoice?.PaymentDeliveryProtocols || []) {
    if (protocol.Deleted) {
      continue
    }

    displayProtocols.push({
      Deleted: protocol.Deleted,
      Discount: protocol.Discount,
      Id: protocol.Id,
      IsAccounting: protocol.IsAccounting,
      NetUid: protocol.NetUid,
      SupplyOrderUkrainePaymentDeliveryProtocolKey: protocol.SupplyOrderPaymentDeliveryProtocolKey
        ? { Key: protocol.SupplyOrderPaymentDeliveryProtocolKey.Key }
        : null,
      SupplyPaymentTask: protocol.SupplyPaymentTask
        ? {
            Comment: protocol.SupplyPaymentTask.Comment,
            PayToDate: protocol.SupplyPaymentTask.PayToDate ?? undefined,
            User: protocol.SupplyPaymentTask.User as unknown as ProtocolUser,
          }
        : null,
      Value: protocol.Value,
    })
  }

  return displayProtocols
}

function addPaymentProtocol(invoice: SupplyInvoice, values: NewPaymentProtocolFormValues): SupplyInvoice {
  const value = Number(values.value) || 0
  const discount = Number(values.discount) || 0
  const key = (values.protocolKey as unknown as SupplyOrderPaymentDeliveryProtocolKey | null) || null
  const user = (values.responsible as unknown as User | null) || null
  const payToDate = values.payToDate ? `${formatLocalDate(values.payToDate)}T00:00:00` : `${formatLocalDate(new Date())}T00:00:00`

  const nextProtocol: SupplyOrderPaymentDeliveryProtocol = {
    Deleted: false,
    Discount: discount,
    IsAccounting: values.isAccounting,
    SupplyInvoiceId: invoice.Id,
    SupplyOrderPaymentDeliveryProtocolKey: key,
    SupplyOrderPaymentDeliveryProtocolKeyId: key?.Id,
    SupplyPaymentTask: {
      Comment: values.comment.trim(),
      Deleted: false,
      GrossPrice: value,
      IsAccounting: values.isAccounting,
      NetPrice: value,
      PayToDate: payToDate,
      User: user,
      UserId: user?.Id,
    },
    User: user,
    UserId: user?.Id,
    Value: value,
  }

  return {
    ...invoice,
    PaymentDeliveryProtocols: [...(invoice.PaymentDeliveryProtocols || []), nextProtocol],
  }
}

function removePaymentProtocol(invoice: SupplyInvoice, netUid?: string, id?: number): SupplyInvoice {
  const protocols = [...(invoice.PaymentDeliveryProtocols || [])]
  const index = protocols.findIndex(
    (protocol) => !protocol.Deleted && ((netUid && protocol.NetUid === netUid) || (id && protocol.Id === id)),
  )

  if (index === -1) {
    return invoice
  }

  const protocol = protocols[index]

  if (!protocol.Id && !protocol.NetUid) {
    protocols.splice(index, 1)
  } else {
    protocols[index] = {
      ...protocol,
      Deleted: true,
      SupplyPaymentTask: protocol.SupplyPaymentTask
        ? { ...protocol.SupplyPaymentTask, Deleted: true }
        : protocol.SupplyPaymentTask,
    }
  }

  return {
    ...invoice,
    PaymentDeliveryProtocols: protocols,
  }
}

/** Mirror the «Інвойси і пак листи» save payload so the server contract is identical. */
function createInvoiceProtocolsPayload(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    InformationDeliveryProtocols: sanitizeInformationDeliveryProtocols(invoice),
    InvoiceDocuments: invoice.InvoiceDocuments || [],
    PackingLists: invoice.PackingLists || [],
    PaymentDeliveryProtocols: sanitizePaymentDeliveryProtocols(invoice),
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: invoice.SupplyInvoiceOrderItems || [],
    SupplyOrder: null,
  } as SupplyInvoice
}

function sanitizePaymentDeliveryProtocols(invoice: SupplyInvoice): SupplyOrderPaymentDeliveryProtocol[] {
  return (invoice.PaymentDeliveryProtocols || []).map((protocol) => {
    const key = protocol.SupplyOrderPaymentDeliveryProtocolKey || null
    const task = protocol.SupplyPaymentTask || null
    const user = task?.User || protocol.User || null
    const value = protocol.Value || 0

    return {
      ...stripEntityGraph(protocol),
      IsAccounting: Boolean(protocol.IsAccounting),
      SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
      SupplyOrderPaymentDeliveryProtocolKey: key,
      SupplyOrderPaymentDeliveryProtocolKeyId: protocol.SupplyOrderPaymentDeliveryProtocolKeyId || key?.Id,
      SupplyPaymentTask: task
        ? {
            ...stripEntityGraph(task),
            GrossPrice: task.GrossPrice ?? value,
            IsAccounting: protocol.IsAccounting ?? task.IsAccounting,
            NetPrice: task.NetPrice ?? value,
            User: user,
            UserId: task.UserId || user?.Id,
          }
        : null,
      SupplyPaymentTaskId: protocol.SupplyPaymentTaskId || task?.Id,
      User: protocol.User || user,
      UserId: protocol.UserId || user?.Id,
      Value: value,
    }
  })
}

function sanitizeInformationDeliveryProtocols(invoice: SupplyInvoice): SupplyInformationDeliveryProtocol[] {
  return (invoice.InformationDeliveryProtocols || []).map((protocol) => {
    const key = protocol.SupplyInformationDeliveryProtocolKey || null
    const user = protocol.User || null

    return {
      ...stripEntityGraph(protocol),
      Created: protocol.Created || invoice.DateFrom || new Date().toISOString(),
      SupplyInformationDeliveryProtocolKey: key,
      SupplyInformationDeliveryProtocolKeyId: protocol.SupplyInformationDeliveryProtocolKeyId || key?.Id,
      SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
      User: user,
      UserId: protocol.UserId || user?.Id,
      Value: protocol.Value || '0',
    }
  })
}

function stripEntityGraph<T extends object>(entity: T): T {
  const result = { ...entity } as Record<string, unknown>

  delete result.SupplyOrder
  delete result.SupplyInvoice
  delete result.PackingList
  delete result.PackingListPackage

  return result as T
}
