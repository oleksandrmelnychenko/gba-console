import { Card, Group, Select, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleTransporterTypes, getSaleTransportersByType } from '../../api/salesUkraineApi'
import type { SalesUkraineSale, SalesUkraineTransporter, SalesUkraineTransporterType } from '../../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function NewSaleReviewStep({
  comment,
  sale,
  transporterId,
  onCommentChange,
  onTransporterChange,
}: {
  comment: string
  onCommentChange: (comment: string) => void
  onTransporterChange: (transporterId: string | null) => void
  sale: SalesUkraineSale | null
  transporterId: string | null
}) {
  const { t } = useI18n()
  const [types, setTypes] = useState<SalesUkraineTransporterType[]>([])
  const [typeNetId, setTypeNetId] = useState<string | null>(null)
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])

  const orderItems = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale?.ClientAgreement?.Agreement?.Currency?.Code || ''
  const total = getNumber(sale?.TotalAmountLocal) ?? getNumber(sale?.Order?.TotalAmountLocal) ?? 0

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

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>{t('Товарів')}: {orderItems.length}</Text>
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
          onChange={(value) => {
            setTypeNetId(value)
            setTransporters([])
            onTransporterChange(null)
          }}
        />
        <Select
          searchable
          clearable
          data={transporters.filter((item) => item.NetUid).map((item) => ({ label: item.Name || item.Title || '', value: item.NetUid || '' }))}
          disabled={!typeNetId}
          label={t('Перевізник')}
          placeholder={t('Оберіть перевізника')}
          value={transporterId}
          onChange={onTransporterChange}
        />
      </Group>

      <Textarea
        autosize
        label={t('Коментар')}
        minRows={2}
        value={comment}
        onChange={(event) => onCommentChange(event.currentTarget.value)}
      />
    </Stack>
  )
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
