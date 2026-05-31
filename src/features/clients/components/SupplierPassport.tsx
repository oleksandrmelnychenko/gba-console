import { Alert, Card, Center, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getClientById } from '../api/clientFormApi'
import type { Client, ClientAgreement } from '../types'

type SupplierPassportProps = {
  netUid?: string | null
  client?: Client | null
}

export function SupplierPassport({ netUid, client }: SupplierPassportProps) {
  const { t } = useI18n()
  const [loadedClient, setLoadedClient] = useValueState<Client | null>(netUid ? null : client ?? null)
  const [isLoading, setLoading] = useValueState(Boolean(netUid))
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    if (!netUid) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function loadClient(targetNetUid: string) {
      try {
        const result = await getClientById(targetNetUid)

        if (!cancelled) {
          setLoadedClient(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити паспорт постачальника'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClient(netUid)

    return () => {
      cancelled = true
    }
  }, [netUid, setError, setLoadedClient, setLoading, t])

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader color="violet" />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
        {error}
      </Alert>
    )
  }

  if (!loadedClient) {
    return (
      <Text c="dimmed" size="sm">
        {t('Дані недоступні')}
      </Text>
    )
  }

  const supplier = loadedClient
  const bankDetails = supplier.ClientBankDetails
  const activeAgreement = (supplier.ClientAgreements || []).find(
    (clientAgreement: ClientAgreement) => clientAgreement.Agreement?.IsActive,
  )?.Agreement
  const ibanCurrency = bankDetails?.ClientBankDetailIbanNo?.Currency?.Name

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md">
        <Text fw={600} mb="xs">
          {t('Загальна інформація')}
        </Text>
        <Stack gap="xs">
          <PassportRow label={t('Повна назва')} value={supplier.FullName} />
          <PassportRow label={t('Бренд')} value={supplier.Brand} />
          <PassportRow label={t('Постачальник')} value={supplier.Manufacturer} />
          <PassportRow label={t('Країна')} value={supplier.Country?.Name} />
        </Stack>
      </Card>

      {supplier.PackingMarking && (
        <Card withBorder padding="md" radius="md">
          <Text fw={600} mb="xs">
            {t('Умови поставки під брендом CONTECH')}
          </Text>
          <Stack gap="xs">
            <PassportRow label={t('Пакування та маркування')} value={supplier.PackingMarking.Name} />
            <PassportRow label={t('Оплата пакування та маркування')} value={supplier.PackingMarkingPayment?.Name} />
          </Stack>
        </Card>
      )}

      <Card withBorder padding="md" radius="md">
        <Text fw={600} mb="xs">
          {t('Умови доставки')}
        </Text>
        <Stack gap="xs">
          {supplier.IncotermsElse ? (
            <PassportRow label={`${t('Incoterms')} ${t('Інше')}`} value={supplier.IncotermsElse} />
          ) : (
            <PassportRow label={t('Incoterms')} value={supplier.TermsOfDelivery?.Name} />
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Text fw={600} mb="xs">
          {t('Дані клієнта')}
        </Text>
        <Stack gap="xs">
          <PassportRow label={t("Ім'я")} value={supplier.SupplierName} />
          <PassportRow label={t('Факс')} value={supplier.FaxNumber} />
          <PassportRow label={t('Email')} value={supplier.EmailAddress} />
          <PassportRow label={t('Мобільний телефон')} value={supplier.MobileNumber} />
          <PassportRow label={t('Телефон')} value={supplier.ClientNumber} />
        </Stack>
      </Card>

      {bankDetails && (
        <Card withBorder padding="md" radius="md">
          <Text fw={600} mb="xs">
            {t('Банківські реквізити')}
          </Text>
          <Stack gap="xs">
            <PassportRow label={t('Банк та відділення')} value={bankDetails.BankAndBranch} />
            <PassportRow label={t('Код відділення')} value={bankDetails.BranchCode} />
            <PassportRow label={t('Swift')} value={bankDetails.Swift} />
            {bankDetails.AccountNumber && (
              <>
                <PassportRow label={t('Номер рахунку')} value={bankDetails.AccountNumber.AccountNumber} />
                <PassportRow label={t('Валюта')} value={bankDetails.AccountNumber.Currency?.Name} />
              </>
            )}
            {bankDetails.ClientBankDetailIbanNo && (
              <>
                <PassportRow label={t('IBAN')} value={bankDetails.ClientBankDetailIbanNo.IBANNO} />
                <PassportRow label={t('Валюта')} value={ibanCurrency} />
              </>
            )}
          </Stack>
        </Card>
      )}

      <Card withBorder padding="md" radius="md">
        <Text fw={600} mb="xs">
          {t('Умови оплати')}
        </Text>
        <Stack gap="xs">
          <PassportRow
            label={t('Умови оплати')}
            value={activeAgreement?.IsPrePaymentFull ? t('Повна оплата') : t('Часткова')}
          />
          {activeAgreement && !activeAgreement.IsPrePaymentFull && (
            <PassportRow label={t('Передоплата')} value={`${activeAgreement.PrePaymentPercentages ?? 0}%`} />
          )}
          <PassportRow
            label={t('Відстрочка платежу')}
            value={`${activeAgreement?.DeferredPayment ?? ''} ${t('днів').toLowerCase()}`.trim()}
          />
          {bankDetails?.ClientBankDetailIbanNo && <PassportRow label={t('Валюта')} value={ibanCurrency} />}
        </Stack>
      </Card>
    </Stack>
  )
}

function PassportRow({ label, value }: { label: string; value?: string | null }) {
  const normalized = value?.trim()

  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={500} size="sm" ta="right">
        {normalized || '-'}
      </Text>
    </Group>
  )
}
