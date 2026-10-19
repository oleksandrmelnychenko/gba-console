import { Box, Group, Text } from '@mantine/core'
import { Mail, Phone, TriangleAlert } from 'lucide-react'
import { memo, useEffect, useState, type ReactNode } from 'react'
import { TableChip } from '../../../../shared/ui/TableChip'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type {
  Client,
  ClientAgreement,
  ClientIdentityAttentionSummary,
  ClientInDebt,
} from '../../../clients/types'
import { WizardClientAgreementsPopover } from './WizardClientAgreementsPopover'
import {
  getWizardClientAgreements,
  getWizardClientGroupedDebts,
  getWizardClientIdentityAttention,
  getWizardSalesRegister,
  mapWizardSaleRegisterItems,
  WIZARD_SALE_REGISTER_STATUS_ALL,
} from './wizardClientStepApi'
import { getWizardClientDebtTotal } from './wizardClientStepModel'
import { WizardLegalPartyRiskPopover } from './WizardLegalPartyRiskPopover'
import { getWizardHeaderClient, type WizardSalesPermissionFlow } from './wizardSaleHeaderApi'

const metricCountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

export const WizardClientHeroHeader = memo(function WizardClientHeroHeader({
  activeAgreementNetId,
  agreements,
  client,
  clientNetId,
  debts,
  groupSize,
  headerClose,
  headerTools,
  permissionFlow = 'create',
  registryCount,
}: {
  activeAgreementNetId?: string | null
  agreements?: ClientAgreement[]
  client?: Client | null
  clientNetId?: string | null
  debts?: ClientInDebt[]
  groupSize?: number
  headerClose?: ReactNode
  headerTools?: ReactNode
  permissionFlow?: WizardSalesPermissionFlow
  registryCount?: number
}) {
  const { t } = useI18n()
  const [loadedClient, setLoadedClient] = useState<{ key: string; value: Client | null } | null>(null)
  const [loadedAgreements, setLoadedAgreements] = useState<{ key: string; value: ClientAgreement[] } | null>(null)
  const [loadedDebts, setLoadedDebts] = useState<{ key: string; value: ClientInDebt[] } | null>(null)
  const [loadedRegistryCount, setLoadedRegistryCount] = useState<{ key: string; value: number } | null>(null)
  const [loadedIdentityAttention, setLoadedIdentityAttention] = useState<{
    key: string
    value: ClientIdentityAttentionSummary | null
  } | null>(null)

  const resolvedClient = client ?? (clientNetId && loadedClient?.key === clientNetId ? loadedClient.value : null)
  const resolvedNetId = clientNetId ?? resolvedClient?.NetUid ?? null

  useEffect(() => {
    if (!resolvedNetId || groupSize !== undefined) {
      return
    }

    const id = resolvedNetId
    let cancelled = false

    async function load() {
      const next = await getWizardClientIdentityAttention(id).catch(() => null)

      if (!cancelled) {
        setLoadedIdentityAttention({ key: id, value: next })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [resolvedNetId, groupSize])

  useEffect(() => {
    if (client || !clientNetId) {
      return
    }

    const id = clientNetId
    let cancelled = false

    async function load() {
      try {
        const next = await getWizardHeaderClient(id, permissionFlow)

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
  }, [client, clientNetId, permissionFlow])

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
  const identityAttention =
    resolvedNetId && loadedIdentityAttention?.key === resolvedNetId
      ? loadedIdentityAttention.value
      : null
  const clientTitle = resolvedClient.FullName || resolvedClient.Name || ''
  const clientCode = resolvedClient.RegionCode?.Value || resolvedClient.ClientNumber || resolvedClient.USREOU || ''
  const clientDebtTotal = visibleDebts.reduce((sum, debt) => sum + getWizardClientDebtTotal(debt), 0)
  const clientContactCandidates: Array<{ key: string; icon: ReactNode; value?: string | null }> = [
    {
      key: 'phone',
      icon: <Phone size={13} />,
      value: resolvedClient.MobileNumber || resolvedClient.SMSNumber,
    },
    {
      key: 'email',
      icon: <Mail size={13} />,
      value: resolvedClient.EmailAddress,
    },
    // Address/location is intentionally hidden in the compact wizard header.
    // {
    //   icon: <IconMapPin size={13} />,
    //   value: resolvedClient.RegionCode?.City,
    // },
  ]
  const clientContacts = clientContactCandidates.filter((item): item is { key: string; icon: ReactNode; value: string } =>
    Boolean(item.value),
  )

  return (
    <Box className="new-sale-client-hero new-sale-client-hero--refined">
      {headerClose && <Box className="new-sale-client-hero__close">{headerClose}</Box>}
      <Box className="new-sale-client-hero__identity">
        <Box className="new-sale-client-hero__copy">
          <Box className="new-sale-client-hero__name" title={clientCode ? `${clientCode} ${clientTitle}` : clientTitle}>
            {clientCode && <TableChip tone="document" value={clientCode} />}
            <span className="new-sale-client-hero__title">{clientTitle}</span>
          </Box>
          <Box className="new-sale-client-hero__details">
            {(clientContacts.length > 0 || (resolvedClient.USREOU && clientCode !== resolvedClient.USREOU)) && (
              <Group className="new-sale-client-hero__contacts" gap={6} wrap="wrap">
                {clientContacts.map((item) => (
                  <a key={item.key} title={item.value} href={item.key === 'phone' ? `tel:${item.value.replace(/[^+\d]/g, '')}` : `mailto:${item.value}`}>
                    {item.icon}
                    {item.value}
                  </a>
                ))}
                {resolvedClient.USREOU && clientCode !== resolvedClient.USREOU && (
                  <Text component="span" className="new-sale-client-hero__legal-code" size="xs">
                    <TableChip value={`${t('ЄДРПОУ')} · ${resolvedClient.USREOU}`} />
                  </Text>
                )}
              </Group>
            )}
            {(clientDebtTotal > 0 || (identityAttention && identityAttention.AttentionLevel !== 'none')) && (
              <Group className="new-sale-client-hero__chips" gap={6} wrap="wrap">
                {clientDebtTotal > 0 && (
                  <span className="new-sale-client-hero__debt">
                    <TriangleAlert size={12} />
                    {t('Є борг')}
                  </span>
                )}
                {identityAttention && identityAttention.AttentionLevel !== 'none' && (
                  <WizardLegalPartyRiskPopover risk={identityAttention} />
                )}
              </Group>
            )}
          </Box>
        </Box>
      </Box>

      <Box className="new-sale-client-hero__side">
        <Box className="new-sale-client-hero__metrics">
          {groupSize !== undefined ? (
            <Box className="new-sale-client-metric">
              <strong>{metricCountFormatter.format(groupSize)}</strong>
              <span>{t('Картки у групі')}</span>
            </Box>
          ) : visibleAgreements.length > 0 ? (
            <WizardClientAgreementsPopover
              activeAgreementNetId={activeAgreementNetId}
              agreements={visibleAgreements}
            />
          ) : (
            <Box className="new-sale-client-metric">
              <strong>{metricCountFormatter.format(visibleAgreements.length)}</strong>
              <span>{t('Договорів')}</span>
            </Box>
          )}
          {groupSize === undefined && (
            <Box className="new-sale-client-metric">
              <strong>{metricCountFormatter.format(visibleRegistryCount)}</strong>
              <span>{getDocumentCountLabel(visibleRegistryCount, t)}</span>
            </Box>
          )}
        </Box>
        {headerTools && <Box className="new-sale-client-hero__tools">{headerTools}</Box>}
      </Box>
    </Box>
  )
})

function getDocumentCountLabel(count: number, t: (value: string) => string): string {
  const form = new Intl.PluralRules('uk').select(count)
  return t(form === 'one' ? 'Документ' : form === 'few' ? 'Документи' : 'Документів')
}
