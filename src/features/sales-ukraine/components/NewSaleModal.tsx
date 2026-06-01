import { Button, Group, Loader, Select, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { createSale, getCurrentSaleCart, getSaleClientAgreements, searchSalesUkraineClients } from '../api/salesUkraineApi'
import type { SalesUkraineClientAgreement, SalesUkraineClientOption, SalesUkraineSale } from '../types'

const LOCAL_ORDER_SOURCE = 1

export function NewSaleModal({
  opened,
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (sale: SalesUkraineSale) => void
  opened: boolean
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="md" title={t('Новий продаж')} onClose={onClose}>
      {opened && <NewSaleForm onCancel={onClose} onCreated={onCreated} />}
    </AppModal>
  )
}

function NewSaleForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (sale: SalesUkraineSale) => void }) {
  const { t } = useI18n()
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<SalesUkraineClientOption[]>([])
  const [clientNetId, setClientNetId] = useState<string | null>(null)
  const [agreements, setAgreements] = useState<SalesUkraineClientAgreement[]>([])
  const [agreementNetId, setAgreementNetId] = useState<string | null>(null)
  const [isLoadingAgreements, setLoadingAgreements] = useState(false)
  const [isCreating, setCreating] = useState(false)

  useEffect(() => {
    const value = clientQuery.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(value)

        if (!cancelled) {
          setClientOptions(next)
        }
      } catch {
        if (!cancelled) {
          setClientOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [clientQuery])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingAgreements(true)

      try {
        const next = await getSaleClientAgreements(id)

        if (!cancelled) {
          setAgreements(next)
        }
      } catch {
        if (!cancelled) {
          setAgreements([])
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

  const clientData = clientOptions
    .filter((client) => client.NetUid)
    .map((client) => ({ label: getClientLabel(client), value: client.NetUid || '' }))
  const agreementData = agreements
    .filter((item) => item.NetUid)
    .map((item) => ({ label: item.Agreement?.Name || item.NetUid || '', value: item.NetUid || '' }))

  async function create() {
    if (!agreementNetId) {
      return
    }

    setCreating(true)

    try {
      const existingSale = await getCurrentSaleCart(agreementNetId)
      const selectedAgreement = agreements.find((item) => item.NetUid === agreementNetId)
      const sale = existingSale || (selectedAgreement ? await createSale(buildNewSalePayload(selectedAgreement)) : null)

      if (sale) {
        notifications.show({ color: 'green', message: existingSale ? t('Продаж відкрито') : t('Продаж створено') })
        onCreated(sale)
      } else {
        notifications.show({ color: 'orange', message: t('Не вдалося відкрити продаж') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити продаж') })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Stack gap="md">
      <Select
        searchable
        data={clientData}
        label={t('Клієнт')}
        leftSection={<IconSearch size={16} />}
        nothingFoundMessage={clientQuery.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
        placeholder={t('Пошук клієнта')}
        searchValue={clientQuery}
        value={clientNetId}
        onChange={(value) => {
          setClientNetId(value)
          setAgreementNetId(null)
          setAgreements([])
        }}
        onSearchChange={setClientQuery}
      />

      <Select
        searchable
        data={agreementData}
        disabled={!clientNetId || isLoadingAgreements}
        label={t('Договір')}
        placeholder={isLoadingAgreements ? t('Завантаження') : t('Оберіть договір')}
        rightSection={isLoadingAgreements ? <Loader size="xs" /> : null}
        value={agreementNetId}
        onChange={setAgreementNetId}
      />

      {clientNetId && agreementData.length === 0 && !isLoadingAgreements && (
        <Text c="dimmed" size="sm">
          {t('У клієнта немає договорів')}
        </Text>
      )}

      <Group justify="flex-end">
        <Button color="gray" disabled={isCreating} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!agreementNetId} loading={isCreating} onClick={create}>
          {t('Створити')}
        </Button>
      </Group>
    </Stack>
  )
}

function buildNewSalePayload(
  agreement: SalesUkraineClientAgreement,
): SalesUkraineSale {
  return {
    ClientAgreement: agreement,
    IsVatSale: Boolean(agreement?.Agreement?.WithVATAccounting),
    Order: {
      OrderItems: [],
      OrderSource: LOCAL_ORDER_SOURCE,
    },
  }
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
