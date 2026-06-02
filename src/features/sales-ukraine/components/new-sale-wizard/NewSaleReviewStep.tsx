import { Alert, Card, Group, Select, Stack, Text, Textarea } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleTransporterTypes, getSaleTransportersByType } from '../../api/salesUkraineApi'
import type { SalesUkraineSale, SalesUkraineTransporter, SalesUkraineTransporterType } from '../../types'
import { getClientDeliveryRecipients, type WizardDeliveryRecipient } from './newSaleWizardApi'
import { isSelfCheckout, type NewSaleReviewValue } from './newSaleWizardState'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function NewSaleReviewStep({
  clientNetId,
  sale,
  value,
  onChange,
}: {
  clientNetId: string | null
  onChange: (patch: Partial<NewSaleReviewValue>) => void
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
}) {
  const { t } = useI18n()
  const [types, setTypes] = useState<SalesUkraineTransporterType[]>([])
  const [typeNetId, setTypeNetId] = useState<string | null>(null)
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])
  const [recipients, setRecipients] = useState<WizardDeliveryRecipient[]>([])

  const orderItems = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale?.ClientAgreement?.Agreement?.Currency?.Code || ''
  const total = getNumber(sale?.TotalAmountLocal) ?? getNumber(sale?.Order?.TotalAmountLocal) ?? 0
  const selfCheckout = isSelfCheckout(value.transporter)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const next = await getSaleTransporterTypes()

        if (!cancelled) {
          setTypes(next)
        }
      } catch {
        if (!cancelled) {
          setTypes([])
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!typeNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const next = await getSaleTransportersByType(id)

        if (!cancelled) {
          setTransporters(next)
        }
      } catch {
        if (!cancelled) {
          setTransporters([])
        }
      }
    }

    void load(typeNetId)

    return () => {
      cancelled = true
    }
  }, [typeNetId])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const next = await getClientDeliveryRecipients(id)

        if (!cancelled) {
          setRecipients(next)
        }
      } catch {
        if (!cancelled) {
          setRecipients([])
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  const addresses = value.recipient?.DeliveryRecipientAddresses || []

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>
            {t('Товарів')}: {orderItems.length}
          </Text>
          <Text fw={700} size="lg">
            {amountFormatter.format(total)} {localCurrencyCode}
          </Text>
        </Group>
      </Card>

      <Group grow align="start">
        <Select
          searchable
          clearable
          data={types.filter((item) => item.NetUid).map((item) => ({ label: item.Name || '', value: item.NetUid || '' }))}
          label={t('Тип перевізника')}
          placeholder={t('Оберіть тип')}
          value={typeNetId}
          onChange={(next) => {
            setTypeNetId(next)
            setTransporters([])
            onChange({ transporter: null })
          }}
        />
        <Select
          searchable
          clearable
          data={transporters.filter((item) => item.NetUid).map((item) => ({ label: item.Name || item.Title || '', value: item.NetUid || '' }))}
          disabled={!typeNetId}
          label={t('Перевізник')}
          placeholder={t('Оберіть перевізника')}
          value={value.transporter?.NetUid ?? null}
          onChange={(next) => onChange({ transporter: transporters.find((item) => item.NetUid === next) || null })}
        />
      </Group>

      {selfCheckout ? (
        <Alert color="blue" icon={<IconInfoCircle size={18} />} variant="light">
          {t('Самовивіз — отримувач не потрібен')}
        </Alert>
      ) : (
        <Group grow align="start">
          <Select
            searchable
            clearable
            data={recipients.filter((item) => item.NetUid).map((item) => ({ label: getRecipientLabel(item), value: item.NetUid || '' }))}
            label={t('Отримувач')}
            placeholder={recipients.length === 0 ? t('Немає отримувачів') : t('Оберіть отримувача')}
            value={value.recipient?.NetUid ?? null}
            onChange={(next) => {
              const recipient = recipients.find((item) => item.NetUid === next) || null
              onChange({ address: null, recipient })
            }}
          />
          <Select
            searchable
            clearable
            data={addresses.filter((item) => item.NetUid).map((item) => ({ label: getAddressLabel(item), value: item.NetUid || '' }))}
            disabled={!value.recipient}
            label={t('Адреса доставки')}
            placeholder={t('Оберіть адресу')}
            value={value.address?.NetUid ?? null}
            onChange={(next) => onChange({ address: addresses.find((item) => item.NetUid === next) || null })}
          />
        </Group>
      )}

      <Textarea
        autosize
        label={t('Коментар')}
        minRows={2}
        value={value.comment}
        onChange={(event) => onChange({ comment: event.currentTarget.value })}
      />
    </Stack>
  )
}

function getRecipientLabel(recipient: WizardDeliveryRecipient): string {
  return [recipient.FullName, recipient.MobilePhone].filter(Boolean).join(' · ') || recipient.NetUid || ''
}

function getAddressLabel(address: { City?: string; Department?: string; Address?: string; NetUid?: string }): string {
  return [address.City, address.Department, address.Address].filter(Boolean).join(', ') || address.NetUid || ''
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
