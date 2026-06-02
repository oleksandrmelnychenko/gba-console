import { Alert, Group, Select, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleClientAgreements, getSaleClientDebtTotal, searchSalesUkraineClients } from '../../api/salesUkraineApi'
import type { SaleClientDebtTotal, SalesUkraineClientAgreement, SalesUkraineClientOption } from '../../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function NewSaleClientStep({
  agreementNetId,
  clientNetId,
  onClientChange,
  onAgreementChange,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  onAgreementChange: (agreementNetId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  onClientChange: (clientNetId: string | null) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<SalesUkraineClientOption[]>([])
  const [agreements, setAgreements] = useState<SalesUkraineClientAgreement[]>([])
  const [isLoadingAgreements, setLoadingAgreements] = useState(false)
  const [debt, setDebt] = useState<SaleClientDebtTotal | null>(null)

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(value)

        if (!cancelled) {
          setClients(next)
        }
      } catch {
        if (!cancelled) {
          setClients([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingAgreements(true)

      try {
        const [nextAgreements, nextDebt] = await Promise.all([getSaleClientAgreements(id), getSaleClientDebtTotal(id)])

        if (!cancelled) {
          setAgreements(nextAgreements)
          setDebt(nextDebt)
        }
      } catch {
        if (!cancelled) {
          setAgreements([])
          setDebt(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingAgreements(false)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  const clientData = clients
    .filter((client) => client.NetUid)
    .map((client) => ({ label: getClientLabel(client), value: client.NetUid || '' }))

  const agreementData = agreements
    .filter((item) => item.NetUid)
    .map((item) => ({ label: item.Agreement?.Name || item.NetUid || '', value: item.NetUid || '' }))

  return (
    <Stack gap="md">
      <Select
        searchable
        clearable
        autoFocus
        data={clientData}
        filter={({ options }) => options}
        label={t('Клієнт')}
        nothingFoundMessage={query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
        placeholder={t('Пошук клієнта')}
        searchValue={query}
        value={clientNetId}
        onChange={(value) => {
          onClientChange(value)
          onAgreementChange(null, null)
          setAgreements([])
          setDebt(null)
        }}
        onSearchChange={setQuery}
      />

      <Select
        searchable
        data={agreementData}
        disabled={!clientNetId || isLoadingAgreements}
        label={t('Договір')}
        placeholder={isLoadingAgreements ? t('Завантаження…') : t('Оберіть договір')}
        value={agreementNetId}
        onChange={(value) => {
          const agreement = agreements.find((item) => item.NetUid === value) || null
          onAgreementChange(value, agreement)
        }}
      />

      {debt && (
        <Alert color="gray" variant="light">
          <Group justify="space-between" gap="xl" wrap="wrap">
            <Text size="sm">
              {t('Борг (локальна)')}: <Text span fw={600}>{amountFormatter.format(debt.TotalLocal ?? 0)}</Text>
            </Text>
            <Text size="sm">
              {t('Борг (EUR)')}: <Text span fw={600}>{amountFormatter.format(debt.TotalEuro ?? 0)}</Text>
            </Text>
          </Group>
        </Alert>
      )}
    </Stack>
  )
}

function getClientLabel(client: SalesUkraineClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || client.NetUid
    || ''
  )
}
