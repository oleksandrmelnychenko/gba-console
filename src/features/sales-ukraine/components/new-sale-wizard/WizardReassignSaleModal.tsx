import { Box, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import { switchSale } from '../../api/salesUkraineApi'
import type { SalesUkraineSale } from '../../types'
import type { Client } from '../../../clients/types'
import { getRootClientBySubClientNetId } from '../../../clients/api/clientCabinetApi'
import { WizardAgreementItem } from './WizardAgreementItem'
import { getReassignRootClientNetId, needsReassignRootLookup } from './wizardReassignSaleModel'
import { getWizardClientStructure, getWizardHeaderClient } from './wizardSaleHeaderApi'

export function WizardReassignSaleModal({
  client,
  opened,
  sale,
  onClose,
  onReassigned,
}: {
  client: Client
  opened: boolean
  sale: SalesUkraineSale
  onClose: () => void
  onReassigned: (movedSale: SalesUkraineSale | null) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={opened}
      size="lg"
      title={`${t('Переміщення продажі')} ${sale.SaleNumber?.Value ?? ''}`.trim()}
      onClose={onClose}
    >
      {opened && <WizardReassignSaleForm client={client} sale={sale} onCancel={onClose} onReassigned={onReassigned} />}
    </AppModal>
  )
}

function WizardReassignSaleForm({
  client,
  sale,
  onCancel,
  onReassigned,
}: {
  client: Client
  sale: SalesUkraineSale
  onCancel: () => void
  onReassigned: (movedSale: SalesUkraineSale | null) => void
}) {
  const { t } = useI18n()
  const [rootClient, setRootClient] = useState<Client | null>(null)
  const [structureClients, setStructureClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(Boolean(client.NetUid))
  const [busy, setBusy] = useState(false)
  const [selectedNetUid, setSelectedNetUid] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(subject: Client) {
      try {
        let rootNetId = getReassignRootClientNetId(subject)

        if (needsReassignRootLookup(subject) && subject.NetUid) {
          const rootLink = await getRootClientBySubClientNetId(subject.NetUid)

          rootNetId = rootLink?.RootClient?.NetUid ?? rootLink?.NetUid ?? rootNetId
        }

        const root = rootNetId ? await getWizardHeaderClient(rootNetId) : null
        const structure = root?.NetUid ? await getWizardClientStructure(root.NetUid) : []

        if (!cancelled) {
          setRootClient(root)
          setStructureClients(structure)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRootClient(null)
          setStructureClients([])
          notifications.show({
            color: 'red',
            message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (client.NetUid) {
      void load(client)
    }

    return () => {
      cancelled = true
    }
  }, [client, t])

  async function save() {
    if (!selectedNetUid) {
      notifications.show({ color: 'red', message: t('Виберіть договір') })

      return
    }

    if (!sale.NetUid) {
      return
    }

    setBusy(true)

    try {
      const movedSale = await switchSale(sale.NetUid, selectedNetUid)

      onReassigned(movedSale)
    } catch (switchError) {
      notifications.show({
        color: 'red',
        message: switchError instanceof Error ? t(switchError.message) : t('Не вдалося виконати запит'),
      })
    } finally {
      setBusy(false)
    }
  }

  const subClients = structureClients.filter((item) => item.IsSubClient)
  const tradePoints = structureClients.filter((item) => item.IsTradePoint)

  return (
    <Stack gap="md">
      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : (
        <Stack gap="sm" mah={420} style={{ overflowY: 'auto' }}>
          {!rootClient && structureClients.length === 0 && (
            <Text c="dimmed" py="md" size="sm" ta="center">
              {t('Немає структури клієнта для переміщення')}
            </Text>
          )}
          {rootClient && (rootClient.Id ?? 0) > 0 && (
            <WizardReassignSection label={t('Основний')}>
              <WizardReassignClientItem client={rootClient} selectedNetUid={selectedNetUid} onSelect={setSelectedNetUid} />
            </WizardReassignSection>
          )}
          {subClients.length > 0 && (
            <WizardReassignSection label={t('Суб-клієнти')}>
              {subClients.map((item, index) => (
                <WizardReassignClientItem
                  client={item}
                  key={String(item.NetUid || item.Id || index)}
                  selectedNetUid={selectedNetUid}
                  onSelect={setSelectedNetUid}
                />
              ))}
            </WizardReassignSection>
          )}
          {tradePoints.length > 0 && (
            <WizardReassignSection label={t('Торгові точки')}>
              {tradePoints.map((item, index) => (
                <WizardReassignClientItem
                  client={item}
                  key={String(item.NetUid || item.Id || index)}
                  selectedNetUid={selectedNetUid}
                  onSelect={setSelectedNetUid}
                />
              ))}
            </WizardReassignSection>
          )}
        </Stack>
      )}
      <Group gap="sm" justify="flex-end">
        <Button color="gray" disabled={busy} variant="light" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button loading={busy} onClick={() => void save()}>
          {t('Перемістити')}
        </Button>
      </Group>
    </Stack>
  )
}

function WizardReassignSection({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Box>
      <Text c="dimmed" fw={600} mb={4} size="xs">
        {label}
      </Text>
      <Stack gap="xs">{children}</Stack>
    </Box>
  )
}

function WizardReassignClientItem({
  client,
  selectedNetUid,
  onSelect,
}: {
  client: Client
  selectedNetUid: string | null
  onSelect: (clientAgreementNetUid: string) => void
}) {
  const agreements = client.ClientAgreements ?? []

  return (
    <Box>
      <Text fw={600} size="sm">
        {client.FullName}
      </Text>
      {agreements.length > 0 && (
        <Stack gap={4} mt={4}>
          {agreements.map((item, index) => {
            const netUid = item.NetUid

            return (
              <WizardAgreementItem
                clientAgreement={item}
                key={String(netUid || item.Id || index)}
                selected={Boolean(netUid) && netUid === selectedNetUid}
                onSelect={netUid ? () => onSelect(netUid) : undefined}
              />
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
