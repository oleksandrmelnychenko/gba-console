import { Button, Card, Group, NumberInput, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { Save } from 'lucide-react'
import { useState } from 'react'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
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

import './supply-order-document-summary.css'

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
    <Stack gap={10}>
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
      padding={12}
      radius="md"
      role="group"
      withBorder
    >
      <Stack gap={10}>
        <Group gap="xs" wrap="nowrap">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Інвойс')}
          </Text>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={12} verticalSpacing={10}>
          <InvoiceField label={t('Номер')} value={invoiceNumber} chip="document" />
          <InvoiceField label={t('Дата')} value={formatDateTime(invoice.DateFrom)} />
          <InvoiceField label={t('Валюта')} value={currency} chip="source" />
          <InvoiceField label={t('Кількість')} value={formatNumber(invoice.TotalQuantity)} />
        </SimpleGrid>

        <SimpleGrid className="supply-order-invoice-financials" cols={{ base: 1, xs: 2, md: 3 }} spacing={12} verticalSpacing={10}>
          <InvoiceField label={t('Сума нетто')} value={formatMoney(amounts.net)} />
          <InvoiceField label={t('ПДВ')} value={formatMoney(amounts.vat)} />
          <InvoiceField label={t('Сума з ПДВ')} value={formatMoney(amounts.withVat)} />
          <InvoiceField label={t('Доставка')} value={formatMoney(invoice.DeliveryAmount)} />
          {canEditDiscount && onSaveDiscount ? (
            <div className="supply-order-invoice-discount">
              <NumberInput
                hideControls
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
              <Tooltip label={t('Зберегти знижку')}>
                <Button
                  aria-label={t('Зберегти знижку')}
                  className="supply-order-invoice-discount__save"
                  color={CREATE_ACTION_COLOR}
                  disabled={!discountChanged || invalidDiscount}
                  loading={isSaving}
                  size="xs"
                  variant="light"
                  onClick={() => void onSaveDiscount(invoice, enteredDiscount)}
                >
                  <Save size={16} />
                </Button>
              </Tooltip>
            </div>
          ) : (
            <InvoiceField label={t('Знижка')} value={formatMoney(invoice.DiscountAmount)} />
          )}
          <InvoiceField label={t('До сплати')} value={formatMoney(paymentAmount)} />
        </SimpleGrid>

        <Stack className={`supply-order-documents${documents.length === 0 ? ' is-empty' : ''}`} gap={8}>
          <Group gap={6} wrap="nowrap">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Документи')}
            </Text>
            <TableChip tone="neutral" value={documents.length} />
          </Group>
          {documents.length === 0 ? (
            <Text className="supply-order-documents__empty" size="xs">
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

function InvoiceField({ chip, label, value }: { chip?: TableChipTone, label: string, value: string }) {
  return (
    <Stack aria-label={label} gap={2} role="group">
      <Text c="gray.8" size="xs">
        {label}
      </Text>
      {chip ? <TableChip tone={chip} value={value} /> : (
        <Text className="supply-order-invoice-value" size="sm">
          {value}
        </Text>
      )}
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
