import { Box, Group, Popover, Stack, Text } from '@mantine/core'
import {
  IconAlertTriangle,
  IconMail,
  IconMapPin,
  IconPhone,
} from '@tabler/icons-react'
import { useEffect, useState, type ReactNode } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import { WizardAgreementItem } from './WizardAgreementItem'
import {
  getWizardClientAgreements,
  getWizardClientGroupedDebts,
  getWizardSalesRegister,
  mapWizardSaleRegisterItems,
  WIZARD_SALE_REGISTER_STATUS_ALL,
} from './wizardClientStepApi'
import { getWizardClientDebtTotal } from './wizardClientStepModel'
import { getWizardHeaderClient } from './wizardSaleHeaderApi'

export function WizardClientHeroHeader({
  activeAgreementNetId,
  agreements,
  client,
  clientNetId,
  debts,
  headerClose,
  headerTools,
  registryCount,
}: {
  activeAgreementNetId?: string | null
  agreements?: ClientAgreement[]
  client?: Client | null
  clientNetId?: string | null
  debts?: ClientInDebt[]
  headerClose?: ReactNode
  headerTools?: ReactNode
  registryCount?: number
}) {
  const { t } = useI18n()
  const [loadedClient, setLoadedClient] = useState<{ key: string; value: Client | null } | null>(null)
  const [loadedAgreements, setLoadedAgreements] = useState<{ key: string; value: ClientAgreement[] } | null>(null)
  const [loadedDebts, setLoadedDebts] = useState<{ key: string; value: ClientInDebt[] } | null>(null)
  const [loadedRegistryCount, setLoadedRegistryCount] = useState<{ key: string; value: number } | null>(null)

  const resolvedClient = client ?? (clientNetId && loadedClient?.key === clientNetId ? loadedClient.value : null)
  const resolvedNetId = clientNetId ?? resolvedClient?.NetUid ?? null

  useEffect(() => {
    if (client || !clientNetId) {
      return
    }

    const id = clientNetId
    let cancelled = false

    async function load() {
      try {
        const next = await getWizardHeaderClient(id)

        if (!cancelled) {
          setLoadedClient({ key: id, value: next })
        }
      } catch {
        if (!cancelled) {
          setLoadedClient({ key: id, value: null })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [client, clientNetId])

  useEffect(() => {
    if (agreements || !resolvedNetId) {
      return
    }

    const id = resolvedNetId
    let cancelled = false

    async function load() {
      try {
        const next = await getWizardClientAgreements(id)

        if (!cancelled) {
          setLoadedAgreements({ key: id, value: next })
        }
      } catch {
        if (!cancelled) {
          setLoadedAgreements({ key: id, value: [] })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [agreements, resolvedNetId])

  useEffect(() => {
    if (debts || !resolvedNetId) {
      return
    }

    const id = resolvedNetId
    let cancelled = false

    async function load() {
      try {
        const next = await getWizardClientGroupedDebts(id)

        if (!cancelled) {
          setLoadedDebts({ key: id, value: next })
        }
      } catch {
        if (!cancelled) {
          setLoadedDebts({ key: id, value: [] })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [debts, resolvedNetId])

  useEffect(() => {
    if (typeof registryCount === 'number' || !resolvedNetId) {
      return
    }

    const id = resolvedNetId
    let cancelled = false

    async function load() {
      const today = new Date()
      const from = new Date(today)
      from.setDate(today.getDate() - 7)

      try {
        const items = await getWizardSalesRegister({
          clientNetId: id,
          from: formatLocalDate(from),
          to: formatLocalDate(today),
          type: WIZARD_SALE_REGISTER_STATUS_ALL,
          value: '',
        })

        if (!cancelled) {
          setLoadedRegistryCount({ key: id, value: mapWizardSaleRegisterItems(items).length })
        }
      } catch {
        if (!cancelled) {
          setLoadedRegistryCount({ key: id, value: 0 })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [registryCount, resolvedNetId])

  if (!resolvedClient) {
    return null
  }

  const visibleAgreements = agreements ?? (resolvedNetId && loadedAgreements?.key === resolvedNetId ? loadedAgreements.value : [])
  const visibleDebts = debts ?? (resolvedNetId && loadedDebts?.key === resolvedNetId ? loadedDebts.value : [])
  const visibleRegistryCount = registryCount ?? (resolvedNetId && loadedRegistryCount?.key === resolvedNetId ? loadedRegistryCount.value : 0)
  const clientTitle = resolvedClient.FullName || resolvedClient.Name || ''
  const clientCode = resolvedClient.RegionCode?.Value || resolvedClient.ClientNumber || resolvedClient.USREOU || ''
  const clientDebtTotal = visibleDebts.reduce((sum, debt) => sum + getWizardClientDebtTotal(debt), 0)
  const clientContactCandidates: Array<{ icon: ReactNode; value?: string | null }> = [
    {
      icon: <IconPhone size={13} />,
      value: resolvedClient.MobileNumber || resolvedClient.SMSNumber,
    },
    {
      icon: <IconMail size={13} />,
      value: resolvedClient.EmailAddress,
    },
    {
      icon: <IconMapPin size={13} />,
      value: resolvedClient.RegionCode?.City,
    },
  ]
  const clientContacts = clientContactCandidates.filter((item): item is { icon: ReactNode; value: string } =>
    Boolean(item.value),
  )
  const clientKind = resolvedClient.IsTradePoint
    ? t('Торгова точка')
    : resolvedClient.IsSubClient
      ? t('Підклієнт')
      : t('Клієнт')
  const isActive = resolvedClient.IsActive !== false

  return (
    <Box className="new-sale-client-hero">
      {headerClose && <Box className="new-sale-client-hero__close">{headerClose}</Box>}
      <Box className="new-sale-client-hero__identity">
        <Box className="new-sale-client-hero__copy">
          <Box className="new-sale-client-hero__name" title={clientCode ? `${clientCode} ${clientTitle}` : clientTitle}>
            {clientCode && <span className="new-sale-client-hero__code">{clientCode}</span>}
            <span className="new-sale-client-hero__title">{clientTitle}</span>
          </Box>
          <Group className="new-sale-client-hero__chips" gap={6} wrap="wrap">
            <span className={`new-sale-client-hero__status ${isActive ? 'is-active' : 'is-inactive'}`}>
              <span className="new-sale-client-hero__status-dot" />
              <span className="new-sale-client-hero__status-copy">
                <strong>{isActive ? t('Активний') : t('Не активний')}</strong>
                <span>{clientKind}</span>
              </span>
            </span>
            {clientDebtTotal > 0 && (
              <span className="new-sale-client-hero__debt">
                <IconAlertTriangle size={12} />
                {t('Є борг')}
              </span>
            )}
          </Group>
          {clientContacts.length > 0 && (
            <Group className="new-sale-client-hero__contacts" gap={8} wrap="nowrap">
              {clientContacts.map((item, index) => (
                <span key={`${item.value}-${index}`} title={item.value}>
                  {item.icon}
                  {item.value}
                </span>
              ))}
            </Group>
          )}
        </Box>
      </Box>

      <Box className="new-sale-client-hero__side">
        <Box className="new-sale-client-hero__metrics">
          {visibleAgreements.length > 0 ? (
            <Popover position="bottom-end" shadow="md" width={500} withinPortal>
              <Popover.Target>
                <Box aria-label={t('Договори')} className="new-sale-client-metric is-clickable" component="button" type="button">
                  <strong>{visibleAgreements.length}</strong>
                  <span>{t('Договори')}</span>
                </Box>
              </Popover.Target>
              <Popover.Dropdown className="new-sale-hero-agreements-dropdown">
                <Group className="new-sale-hero-agreements-dropdown__head" justify="space-between" wrap="nowrap">
                  <Text className="new-sale-hero-agreements-dropdown__title">{t('Договори')}</Text>
                  <span>{visibleAgreements.length}</span>
                </Group>
                <Stack className="new-sale-hero-agreements-dropdown__list" gap={7}>
                  {visibleAgreements.map((item, index) => (
                    <WizardAgreementItem
                      key={String(item.NetUid || item.Id || index)}
                      clientAgreement={item}
                      selected={Boolean(activeAgreementNetId) && getHeroAgreementKey(item) === activeAgreementNetId}
                    />
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <Box className="new-sale-client-metric">
              <strong>{visibleAgreements.length}</strong>
              <span>{t('Договори')}</span>
            </Box>
          )}
          <Box className="new-sale-client-metric">
            <strong>{visibleRegistryCount}</strong>
            <span>{t('Документи')}</span>
          </Box>
        </Box>
        {headerTools && <Box className="new-sale-client-hero__tools">{headerTools}</Box>}
      </Box>
    </Box>
  )
}

function getHeroAgreementKey(agreement: ClientAgreement): string {
  return String(agreement.NetUid || agreement.Id || '')
}
