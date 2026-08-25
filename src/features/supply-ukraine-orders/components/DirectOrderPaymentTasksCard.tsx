import { Alert, Card, Group, Loader, Select, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
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
  updateSupplyProForm,
} from '../api/supplyUkraineOrdersApi'
import {
  sanitizeInvoicePaymentDeliveryProtocols,
  sanitizeProFormPaymentDeliveryProtocols,
} from '../invoicePaymentProtocolPayload'
import { getInvoicePaymentAmount } from '../orderAmountBreakdown'
import { hasSupplyProForm } from '../proFormHelpers'
import type {
  DirectSupplyOrder,
  SupplyInformationDeliveryProtocol,
  SupplyInvoice,
  SupplyOrderPaymentDeliveryProtocol,
  SupplyOrderPaymentDeliveryProtocolKey,
  SupplyProForm,
  User,
} from '../types'

const PRO_FORM_PAYMENT_SOURCE = 'pro-form'
const INVOICE_PAYMENT_SOURCE_PREFIX = 'invoice:'

/**
 * Direct-order payment protocols can belong either to the saved proforma or to an invoice.
 * Keep those sources explicit so a proforma payment task is never silently attached to an invoice.
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
  const [proForm, setProForm] = useValueState<SupplyProForm | null>(() => getSavedProForm(order))
  const paymentSources = useMemo(
    () => createPaymentSourceOptions(proForm, invoices, t),
    [invoices, proForm, t],
  )
  const [selectedPaymentSource, setSelectedPaymentSource] = useValueState<string | null>(
    () => paymentSources[0]?.value || null,
  )
  const selectedInvoiceNetId = getInvoiceNetId(selectedPaymentSource)
  const selectedInvoiceSummary = invoices.find((entry) => entry.NetUid === selectedInvoiceNetId)
  const selectedInvoiceUpdated = selectedInvoiceSummary?.Updated
  const selectedInvoiceNetPrice = selectedInvoiceSummary?.NetPrice
  const selectedInvoiceDeliveryAmount = selectedInvoiceSummary?.DeliveryAmount
  const selectedInvoiceDiscountAmount = selectedInvoiceSummary?.DiscountAmount
  const [invoice, setInvoice] = useValueState<SupplyInvoice | null>(null)
  const [protocolKeys, setProtocolKeys] = useValueState<SupplyOrderPaymentDeliveryProtocolKey[]>([])
  const [users, setUsers] = useValueState<User[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setLocalError] = useValueState<string | null>(null)
  const selectedInvoice = invoice?.NetUid === selectedInvoiceNetId ? invoice : null

  const reportError = useCallback((cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback
    setLocalError(message)
    onError?.(message)
  }, [onError, setLocalError])

  useEffect(() => {
    setProForm(getSavedProForm(order))
  }, [order, setProForm])

  // Keep the selected payment document valid as the order reloads or a proforma is saved.
  useEffect(() => {
    setSelectedPaymentSource((current) =>
      paymentSources.some((source) => source.value === current)
        ? current
        : paymentSources[0]?.value || null,
    )
  }, [paymentSources, setSelectedPaymentSource])

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
      setLoading(false)
      return
    }

    let cancelled = false
    setInvoice(null)

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
  }, [
    reportError,
    selectedInvoiceDeliveryAmount,
    selectedInvoiceDiscountAmount,
    selectedInvoiceNetId,
    selectedInvoiceNetPrice,
    selectedInvoiceUpdated,
    setInvoice,
    setLoading,
    setLocalError,
    t,
  ])

  async function persistInvoice(
    nextInvoice: SupplyInvoice,
    targetProtocols: SupplyOrderPaymentDeliveryProtocol[],
  ): Promise<void> {
    if (!order.NetUid) {
      return
    }

    setSaving(true)
    setLocalError(null)

    try {
      await updateSupplyInvoice(
        order.NetUid,
        createInvoiceProtocolsPayload(nextInvoice, targetProtocols),
      )
      const reloaded = await getSupplyInvoiceItems(nextInvoice.NetUid || selectedInvoiceNetId || '')
      setInvoice(reloaded)
    } catch (cause) {
      reportError(cause, t('Не вдалося зберегти протоколи'))
      throw cause
    } finally {
      setSaving(false)
    }
  }

  async function persistProForm(
    nextProForm: SupplyProForm,
    targetProtocols: SupplyOrderPaymentDeliveryProtocol[],
  ): Promise<void> {
    if (!order.NetUid) {
      return
    }

    setSaving(true)
    setLocalError(null)

    try {
      const updated = await updateSupplyProForm(
        order.NetUid,
        createProFormProtocolsPayload(nextProForm, targetProtocols),
      )

      if (!updated) {
        throw new Error(t('Не вдалося завантажити оновлену проформу'))
      }

      setProForm(updated)
    } catch (cause) {
      reportError(cause, t('Не вдалося зберегти протоколи'))
      throw cause
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(values: NewPaymentProtocolFormValues): Promise<void> {
    if (selectedPaymentSource === PRO_FORM_PAYMENT_SOURCE && proForm) {
      const nextProForm = addPaymentProtocol(proForm, values, {
        SupplyInvoiceId: null,
        SupplyProFormId: proForm.Id,
      })
      const targetProtocol = nextProForm.PaymentDeliveryProtocols?.at(-1)

      if (!targetProtocol) {
        throw new Error(t('Не вдалося підготувати платіжний протокол'))
      }

      await persistProForm(nextProForm, [targetProtocol])
      return
    }

    if (!selectedInvoice) {
      return
    }

    const nextInvoice = addPaymentProtocol(selectedInvoice, values, {
      SupplyInvoiceId: selectedInvoice.Id,
      SupplyProFormId: null,
    })
    const targetProtocol = nextInvoice.PaymentDeliveryProtocols?.at(-1)

    if (!targetProtocol) {
      throw new Error(t('Не вдалося підготувати платіжний протокол'))
    }

    await persistInvoice(nextInvoice, [targetProtocol])
  }

  async function handleRemove(protocol: SupplyOrderUkrainePaymentDeliveryProtocol): Promise<void> {
    if (selectedPaymentSource === PRO_FORM_PAYMENT_SOURCE && proForm) {
      const nextProForm = removePaymentProtocol(proForm, protocol.NetUid, protocol.Id)
      const targetProtocol = findDeletedPaymentProtocol(nextProForm, protocol)

      if (!targetProtocol) {
        throw new Error(t('Не вдалося знайти платіжний протокол'))
      }

      await persistProForm(nextProForm, [targetProtocol])
      return
    }

    if (!selectedInvoice) {
      return
    }

    const nextInvoice = removePaymentProtocol(selectedInvoice, protocol.NetUid, protocol.Id)
    const targetProtocol = findDeletedPaymentProtocol(nextInvoice, protocol)

    if (!targetProtocol) {
      throw new Error(t('Не вдалося знайти платіжний протокол'))
    }

    await persistInvoice(nextInvoice, [targetProtocol])
  }

  const activePaymentDocument = selectedPaymentSource === PRO_FORM_PAYMENT_SOURCE ? proForm : selectedInvoice
  const displayProtocols = mapToDisplayProtocols(activePaymentDocument)
  const totalGrossPriceLocal = selectedPaymentSource === PRO_FORM_PAYMENT_SOURCE
    ? Number(proForm?.NetPrice) || 0
    : selectedInvoice
      ? getInvoicePaymentAmount(selectedInvoice)
      : 0
  const isPaymentDocumentLoading = Boolean(selectedInvoiceNetId && !selectedInvoice) || isLoading

  return (
    <Card className="supply-detail-card" withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Платіжні задачі')}
        </Text>

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {paymentSources.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Спочатку створіть проформу або інвойс для замовлення')}
          </Text>
        ) : (
          <>
            {paymentSources.length > 1 && (
              <Select
                data={paymentSources}
                label={t('Документ для платіжної задачі')}
                value={selectedPaymentSource}
                w={320}
                onChange={(value) => setSelectedPaymentSource(value)}
              />
            )}

            {isPaymentDocumentLoading ? (
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

type PaymentProtocolDocument = {
  PaymentDeliveryProtocols?: SupplyOrderPaymentDeliveryProtocol[]
}

type PaymentSourceLink = Pick<
  SupplyOrderPaymentDeliveryProtocol,
  'SupplyInvoiceId' | 'SupplyProFormId'
>

type PaymentSourceOption = {
  label: string
  value: string
}

function mapToDisplayProtocols(document: PaymentProtocolDocument | null): SupplyOrderUkrainePaymentDeliveryProtocol[] {
  const displayProtocols: SupplyOrderUkrainePaymentDeliveryProtocol[] = []

  for (const protocol of document?.PaymentDeliveryProtocols || []) {
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

function addPaymentProtocol<TDocument extends PaymentProtocolDocument>(
  document: TDocument,
  values: NewPaymentProtocolFormValues,
  sourceLink: PaymentSourceLink,
): TDocument {
  const value = Number(values.value) || 0
  const discount = Number(values.discount) || 0
  const key = (values.protocolKey as unknown as SupplyOrderPaymentDeliveryProtocolKey | null) || null
  const user = (values.responsible as unknown as User | null) || null
  const payToDate = values.payToDate ? `${formatLocalDate(values.payToDate)}T00:00:00` : `${formatLocalDate(new Date())}T00:00:00`

  const nextProtocol: SupplyOrderPaymentDeliveryProtocol = {
    Deleted: false,
    Discount: discount,
    IsAccounting: values.isAccounting,
    ...sourceLink,
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
    ...document,
    PaymentDeliveryProtocols: [...(document.PaymentDeliveryProtocols || []), nextProtocol],
  }
}

function removePaymentProtocol<TDocument extends PaymentProtocolDocument>(
  document: TDocument,
  netUid?: string,
  id?: number,
): TDocument {
  const protocols = [...(document.PaymentDeliveryProtocols || [])]
  const index = protocols.findIndex(
    (protocol) => !protocol.Deleted && ((netUid && protocol.NetUid === netUid) || (id && protocol.Id === id)),
  )

  if (index === -1) {
    return document
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
    ...document,
    PaymentDeliveryProtocols: protocols,
  }
}

function findDeletedPaymentProtocol(
  document: PaymentProtocolDocument,
  protocol: SupplyOrderUkrainePaymentDeliveryProtocol,
): SupplyOrderPaymentDeliveryProtocol | undefined {
  return document.PaymentDeliveryProtocols?.find(
    (candidate) =>
      candidate.Deleted &&
      ((protocol.NetUid && candidate.NetUid === protocol.NetUid) ||
        (protocol.Id && candidate.Id === protocol.Id)),
  )
}

/** Mirror the «Інвойси і пак листи» save payload so the server contract is identical. */
function createInvoiceProtocolsPayload(
  invoice: SupplyInvoice,
  targetProtocols: SupplyOrderPaymentDeliveryProtocol[],
): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    InformationDeliveryProtocols: sanitizeInformationDeliveryProtocols(invoice),
    InvoiceDocuments: invoice.InvoiceDocuments || [],
    PackingLists: invoice.PackingLists || [],
    PaymentDeliveryProtocols: sanitizeInvoicePaymentDeliveryProtocols(
      invoice,
      targetProtocols,
    ),
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: invoice.SupplyInvoiceOrderItems || [],
    SupplyOrder: null,
  } as SupplyInvoice
}

function createProFormProtocolsPayload(
  proForm: SupplyProForm,
  targetProtocols: SupplyOrderPaymentDeliveryProtocol[],
): SupplyProForm {
  return {
    ...stripEntityGraph(proForm),
    InformationDeliveryProtocols: proForm.InformationDeliveryProtocols || [],
    PaymentDeliveryProtocols: sanitizeProFormPaymentDeliveryProtocols(
      proForm,
      targetProtocols,
    ),
    ProFormDocuments: proForm.ProFormDocuments || [],
  }
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
  delete result.SupplyProForm
  delete result.PackingList
  delete result.PackingListPackage

  return result as T
}

function getSavedProForm(order: DirectSupplyOrder): SupplyProForm | null {
  return hasSupplyProForm(order) && order.SupplyProForm ? order.SupplyProForm : null
}

function createPaymentSourceOptions(
  proForm: SupplyProForm | null,
  invoices: SupplyInvoice[],
  t: (value: string) => string,
): PaymentSourceOption[] {
  const options: PaymentSourceOption[] = []

  for (const entry of invoices) {
    if (!entry.NetUid) {
      continue
    }

    options.push({
      label: formatPaymentSourceLabel(t('Інвойс'), entry.Number, entry.NetUid),
      value: `${INVOICE_PAYMENT_SOURCE_PREFIX}${entry.NetUid}`,
    })
  }

  // Preserve the existing invoice default when both document types exist.
  if (proForm) {
    options.push({
      label: formatPaymentSourceLabel(t('Проформа'), proForm.Number, proForm.NetUid),
      value: PRO_FORM_PAYMENT_SOURCE,
    })
  }

  return options
}

function formatPaymentSourceLabel(kind: string, number?: string, netUid?: string): string {
  const identifier = number?.trim() || netUid?.trim() || ''

  return identifier ? `${kind} ${identifier}` : kind
}

function getInvoiceNetId(paymentSource: string | null): string | null {
  if (!paymentSource?.startsWith(INVOICE_PAYMENT_SOURCE_PREFIX)) {
    return null
  }

  return paymentSource.slice(INVOICE_PAYMENT_SOURCE_PREFIX.length) || null
}
