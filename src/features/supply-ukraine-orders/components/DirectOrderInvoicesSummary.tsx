import { Button, Card, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core'
import { FileText, ReceiptText, Save } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getInvoiceAmountBreakdown,
  getInvoiceDiscountLimit,
  getInvoicePaymentAmount,
} from '../orderAmountBreakdown'
import type {
  DirectSupplyOrder,
  SupplyInvoice,
  SupplyInvoiceDeliveryDocument,
} from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const numberFormatter = new Intl.NumberFormat('uk-UA')

/** Invoice facts that remain visible on the order's logistics path after upload. */
export function DirectOrderInvoicesSummary({
  canEditDiscount = false,
  isSaving = false,
  onSaveDiscount,
  order,
}: {
  canEditDiscount?: boolean
  isSaving?: boolean
  onSaveDiscount?: (invoice: SupplyInvoice, discountAmount: number) => Promise<void>
  order: DirectSupplyOrder
}) {
  const invoices = order.SupplyInvoices || []

  if (invoices.length === 0) {
    return null
  }

  return (
    <Stack gap="md">
      {invoices.map((invoice, index) => (
        <InvoiceSummaryCard
          canEditDiscount={canEditDiscount}
          index={index}
          invoice={invoice}
          isSaving={isSaving}
          key={getInvoiceIdentity(invoice, index)}
          onSaveDiscount={onSaveDiscount}
          order={order}
        />
      ))}
    </Stack>
  )
}

function InvoiceSummaryCard({
  canEditDiscount,
  index,
  invoice,
  isSaving,
  onSaveDiscount,
  order,
}: {
  canEditDiscount: boolean
  index: number
  invoice: SupplyInvoice
  isSaving: boolean
  onSaveDiscount?: (invoice: SupplyInvoice, discountAmount: number) => Promise<void>
  order: DirectSupplyOrder
}) {
  const { t } = useI18n()
  const persistedDiscountValue = toNonNegativeAmount(invoice.DiscountAmount)
  const persistedDiscount = persistedDiscountValue === '' ? 0 : persistedDiscountValue
  const [discountValue, setDiscountValue] = useState<number | ''>(persistedDiscount)
  const amounts = getInvoiceAmountBreakdown(invoice)
  const invoiceNumber = invoice.Number?.trim() || ''
  const currency = getInvoiceCurrency(invoice, order)
  const documents = getInvoiceDocuments(invoice)
  const discountLimit = getInvoiceDiscountLimit(invoice)
  const enteredDiscount = discountValue === '' ? 0 : discountValue
  const invalidDiscount = enteredDiscount > discountLimit
  const discountChanged = Math.abs(enteredDiscount - persistedDiscount) >= 0.005
  const paymentAmount = canEditDiscount
    ? discountLimit - enteredDiscount
    : getInvoicePaymentAmount(invoice)

  return (
    <Card
      aria-label={`${t('Інвойс')} ${invoiceNumber || index + 1}`}
      className="supply-detail-card supply-order-invoice-summary"
      padding="lg"
      radius="md"
      role="group"
      withBorder
    >
      <Stack gap="md">
        <Group gap="xs" wrap="nowrap">
          <ReceiptText aria-hidden size={18} />
          <Text className="app-section-title" fw={600} size="sm">
            {t('Інвойс')}
          </Text>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <InvoiceField label={t('Номер')} value={invoiceNumber} />
          <InvoiceField label={t('Сума нетто')} value={formatMoney(amounts.net)} />
          <InvoiceField label={t('Дата')} value={formatDateTime(invoice.DateFrom)} />
          <InvoiceField label={t('Валюта')} value={currency} />
          <InvoiceField label={t('Кількість')} value={formatNumber(invoice.TotalQuantity)} />
          <InvoiceField label={t('Доставка')} value={formatMoney(invoice.DeliveryAmount)} />
          {canEditDiscount && onSaveDiscount ? (
            <Stack gap="xs">
              <NumberInput
                allowNegative={false}
                clampBehavior="none"
                decimalScale={2}
                disabled={isSaving}
                error={invalidDiscount
                  ? `${t('Знижка не може перевищувати')} ${formatMoney(discountLimit)}`
                  : undefined}
                label={t('Знижка')}
                min={0}
                value={discountValue}
                onChange={(value) => setDiscountValue(toNonNegativeAmount(value))}
              />
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={!discountChanged || invalidDiscount}
                leftSection={<Save size={15} />}
                loading={isSaving}
                size="xs"
                variant="light"
                onClick={() => void onSaveDiscount(invoice, enteredDiscount)}
              >
                {t('Зберегти знижку')}
              </Button>
            </Stack>
          ) : (
            <InvoiceField label={t('Знижка')} value={formatMoney(invoice.DiscountAmount)} />
          )}
          <InvoiceField label={t('До сплати')} value={formatMoney(paymentAmount)} />
          <InvoiceField label={t('ПДВ')} value={formatMoney(amounts.vat)} />
          <InvoiceField label={t('Сума з ПДВ')} value={formatMoney(amounts.withVat)} />
        </SimpleGrid>

        <Stack gap="xs">
          <Group gap="xs" wrap="nowrap">
            <FileText aria-hidden size={16} />
            <Text className="app-section-title" fw={600} size="sm">
              {t('Документи')}
            </Text>
          </Group>
          {documents.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Документів немає')}
            </Text>
          ) : (
            <Group gap="xs" wrap="wrap">
              {documents.map((document, documentIndex) => {
                const url = document.DocumentUrl || document.Url
                const label = document.FileName || document.GeneratedName || t('Документ')

                return url ? (
                  <a
                    className="document-link supply-order-invoice-document"
                    href={upgradeHttpToHttps(url)}
                    key={getDocumentKey(document, documentIndex)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {label}
                  </a>
                ) : (
                  <Text
                    className="supply-order-invoice-document"
                    key={getDocumentKey(document, documentIndex)}
                    size="sm"
                  >
                    {label}
                  </Text>
                )
              })}
            </Group>
          )}
        </Stack>
      </Stack>
    </Card>
  )
}

function InvoiceField({ label, value }: { label: string, value: string }) {
  return (
    <Stack aria-label={label} gap={2} role="group">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text className="supply-order-invoice-value" size="sm">
        {value}
      </Text>
    </Stack>
  )
}

function getInvoiceIdentity(invoice: SupplyInvoice, index: number): string {
  if (invoice.NetUid) {
    return invoice.NetUid
  }

  if (invoice.Id != null) {
    return `invoice-id:${invoice.Id}`
  }

  return `invoice:${invoice.Number || ''}:${invoice.DateFrom || ''}:${index}`
}

function getInvoiceCurrency(invoice: SupplyInvoice, order: DirectSupplyOrder): string {
  return invoice.SupplyOrganizationAgreement?.Currency?.Code
    || invoice.SupplyOrganizationAgreement?.Currency?.Name
    || invoice.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code
    || invoice.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Name
    || order.ClientAgreement?.Agreement?.Currency?.Code
    || order.ClientAgreement?.Agreement?.Currency?.Name
    || ''
}

function getInvoiceDocuments(invoice: SupplyInvoice): SupplyInvoiceDeliveryDocument[] {
  const result: SupplyInvoiceDeliveryDocument[] = []
  const seen = new Set<string>()

  for (const document of [
    ...(invoice.InvoiceDocuments || []),
    ...(invoice.SupplyInvoiceDeliveryDocuments || []),
  ]) {
    if (document.Deleted) {
      continue
    }

    const key = getDocumentKey(document, result.length)

    if (!seen.has(key)) {
      seen.add(key)
      result.push(document)
    }
  }

  return result
}

function getDocumentKey(document: SupplyInvoiceDeliveryDocument, index: number): string {
  return document.NetUid
    || document.DocumentUrl
    || document.Url
    || document.FileName
    || document.GeneratedName
    || String(document.Id || index)
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : ''
}

function toNonNegativeAmount(value?: number | string): number | '' {
  if (value === '' || value === undefined) {
    return ''
  }

  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : ''
}
