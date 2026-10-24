import { Box, Stack, Text, UnstyledButton } from '@mantine/core'
import { memo } from 'react'
import { UserRound } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import type { Client } from '../../../clients/types'

export const WizardClientStack = memo(function WizardClientStack({ clients, selectedClientKey, onPick }: {
  clients: Client[]
  selectedClientKey: string
  onPick: (client: Client) => void
}) {
  return (
    <Stack gap={5}>
      {clients.map((client, index) => (
        <ClientViewerRow key={getClientKey(client, index)} client={client}
          isSelected={isSelectedClient(client, selectedClientKey)} onPick={onPick} />
      ))}
    </Stack>
  )
})

const ClientViewerRow = memo(function ClientViewerRow({
  client,
  isSelected,
  onPick,
}: {
  client: Client
  isSelected: boolean
  onPick: (client: Client) => void
}) {
  const { t } = useI18n()
  const hasDebt = (client.ClientInDebts?.length ?? 0) > 0
  const rowClassName = [
    'new-sale-client-drum-row app-selection-surface',
    isSelected ? 'is-selected' : '',
    hasDebt ? 'has-debt' : '',
    client.IsTradePoint ? 'is-trade-point' : '',
    client.IsSubClient ? 'is-sub-client' : '',
  ].filter(Boolean).join(' ')
  const code = client.RegionCode?.Value || client.ClientNumber || client.USREOU || ''

  return (
    <UnstyledButton
      className={rowClassName}
      data-selected={isSelected || undefined}
      aria-pressed={isSelected}
      data-client-net-uid={String(client.NetUid ?? '').toLowerCase()}
      data-testid="wizard-client-row"
      onClick={() => onPick(client)}
    >
      <span className="app-selection-surface__marker" aria-hidden="true" />
      <Box className="new-sale-client-drum-row__content">
        <ClientStatusIcon active={Boolean(client.IsActive)} hasDebt={hasDebt} />
        <Box className="new-sale-client-drum-row__copy">
          {code && (
            <Box className="new-sale-client-drum-row__code">
              <TableChip tone="document" value={code} />
              {hasDebt && <TableChip tone="danger" value={t('Є борг')} />}
            </Box>
          )}
          <Text className="new-sale-client-drum-row__name" title={client.FullName}>
            {client.FullName}
          </Text>
        </Box>
      </Box>
    </UnstyledButton>
  )
})

export const WizardClientMiniCard = memo(function WizardClientMiniCard({ client, hasDebt, hideName }: { client: Client; hasDebt: boolean; hideName: boolean }) {
  const { t } = useI18n()
  const isDebt = hasDebt || (client.ClientInDebts?.length ?? 0) > 0
  const code = client.RegionCode?.Value || client.ClientNumber || client.USREOU || ''

  return (
    <Box
      className="new-sale-client-drum-card app-selection-surface"
      data-selected="true"
      data-client-net-uid={String(client.NetUid ?? '').toLowerCase()}
      data-testid="wizard-selected-client"
    >
      <span className="app-selection-surface__marker" aria-hidden="true" />
      <ClientStatusIcon active={Boolean(client.IsActive)} hasDebt={isDebt} />
      <Box className="new-sale-client-drum-card__copy">
        <Box className="new-sale-client-drum-card__chips">
          <TableChip tone="document" value={code} />
          {isDebt && <TableChip tone="danger" value={t('Є борг')} />}
        </Box>
        {!hideName && (
          <Text className="new-sale-client-drum-card__name">{client.FullName}</Text>
        )}
      </Box>
    </Box>
  )
})

function ClientStatusIcon({ active, hasDebt }: { active: boolean; hasDebt: boolean }) {
  const { t } = useI18n()
  const label = [t(active ? 'Активний клієнт' : 'Неактивний клієнт'), hasDebt ? t('Є борг') : ''].filter(Boolean).join(' · ')
  return (
    <span className="new-sale-client-drum-icon" role="img" aria-label={label} title={label}>
      <UserRound size={18} strokeWidth={1.7} aria-hidden="true" />
      <span className={`new-sale-client-drum-icon__lamp ${active ? 'is-active' : ''}`} />
    </span>
  )
}

function getClientKey(client: Client, index: number): string {
  return String(client.NetUid || client.Id || index)
}

function isSelectedClient(client: Client, selectedClientKey: string): boolean {
  return Boolean(selectedClientKey) && String(client.NetUid || client.Id || '') === selectedClientKey
}
