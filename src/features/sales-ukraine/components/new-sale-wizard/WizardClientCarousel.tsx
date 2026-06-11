import { Box, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconBuildingStore, IconUsers } from '@tabler/icons-react'
import type { RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client } from '../../../clients/types'
import type { WizardClientCarouselState } from './wizardClientStepModel'

export function WizardClientCarousel({
  carousel,
  hasDebt,
  hideName,
  searchInputRef,
  searchValue,
  selectedClientKey,
  onPickClient,
  onSearchChange,
}: {
  carousel: WizardClientCarouselState
  hasDebt: boolean
  hideName: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
  selectedClientKey: string
  onPickClient: (client: Client) => void
  onSearchChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0, overflow: 'hidden' }}>
        <Stack gap={2}>
          {carousel.dataTop.map((client, index) => (
            <ClientViewerRow
              key={getClientKey(client, index)}
              client={client}
              isSelected={isSelectedClient(client, selectedClientKey)}
              onPick={onPickClient}
            />
          ))}
        </Stack>
      </Box>

      <Box py={6} style={{ flexShrink: 0 }}>
        <input
          ref={searchInputRef}
          autoFocus
          placeholder={t('Місце вводу для пошуку')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid var(--mantine-color-violet-4)',
            fontSize: 14,
            outline: 'none',
            padding: '6px 4px',
            width: '100%',
          }}
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />

        {carousel.showDetails && carousel.selected && (
          <ClientMiniCard client={carousel.selected} hasDebt={hasDebt} hideName={hideName} />
        )}
      </Box>

      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Stack gap={2}>
          {carousel.dataBottom.map((client, index) => (
            <ClientViewerRow
              key={getClientKey(client, index)}
              client={client}
              isSelected={isSelectedClient(client, selectedClientKey)}
              onPick={onPickClient}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  )
}

function ClientViewerRow({
  client,
  isSelected,
  onPick,
}: {
  client: Client
  isSelected: boolean
  onPick: (client: Client) => void
}) {
  const hasDebt = (client.ClientInDebts?.length ?? 0) > 0
  const nameColor = hasDebt ? 'var(--mantine-color-red-7)' : undefined

  return (
    <UnstyledButton
      px={6}
      py={4}
      style={{
        background: isSelected ? 'var(--mantine-color-violet-light)' : undefined,
        borderRadius: 6,
        minWidth: 0,
        width: '100%',
      }}
      onClick={() => onPick(client)}
    >
      {client.IsTradePoint ? (
        <Box style={{ alignItems: 'center', display: 'flex', gap: 6, minWidth: 0 }}>
          <IconBuildingStore size={14} style={{ color: 'var(--mantine-color-gray-6)', flexShrink: 0 }} />
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {client.RegionCode?.Value}
          </Text>
          <Text size="sm" style={{ color: nameColor }} title={client.FullName} truncate>
            {client.FullName}
          </Text>
        </Box>
      ) : client.IsSubClient ? (
        <Box style={{ alignItems: 'center', display: 'flex', gap: 6, minWidth: 0 }}>
          <IconUsers size={14} style={{ color: 'var(--mantine-color-gray-6)', flexShrink: 0 }} />
          <Text size="sm" style={{ color: nameColor }} title={client.FullName} truncate>
            {client.FullName}
          </Text>
        </Box>
      ) : (
        <Box style={{ minWidth: 0 }}>
          <Box style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
            <Box
              style={{
                background: hasDebt
                  ? 'var(--mantine-color-red-6)'
                  : client.IsActive
                    ? 'var(--mantine-color-green-6)'
                    : 'var(--mantine-color-gray-4)',
                borderRadius: '50%',
                flexShrink: 0,
                height: 8,
                width: 8,
              }}
            />
            <Text fw={600} size="xs">
              {client.RegionCode?.Value}
            </Text>
          </Box>
          <Text c={hasDebt ? 'red.7' : 'dimmed'} size="sm" title={client.FullName} truncate>
            {client.FullName}
          </Text>
        </Box>
      )}
    </UnstyledButton>
  )
}

function ClientMiniCard({ client, hasDebt, hideName }: { client: Client; hasDebt: boolean; hideName: boolean }) {
  const isDebt = hasDebt || (client.ClientInDebts?.length ?? 0) > 0
  const color = isDebt ? 'red.7' : 'violet.7'

  return (
    <Box
      mt={6}
      px={6}
      py={4}
      style={{
        background: 'var(--mantine-color-violet-light)',
        borderRadius: 6,
        minWidth: 0,
      }}
    >
      {client.IsSubClient ? (
        <Text c={color} fw={700} size="sm" title={client.FullName} truncate>
          {client.FullName}
        </Text>
      ) : (
        <Box style={{ alignItems: 'baseline', display: 'flex', gap: 6, minWidth: 0 }}>
          <Text c={color} fw={700} size="sm" style={{ flexShrink: 0 }}>
            {client.RegionCode?.Value}
          </Text>
          {!hideName && (
            <Tooltip disabled={!client.FullName} label={client.FullName} multiline maw={360}>
              <Text c={color} size="sm" truncate>
                {client.FullName}
              </Text>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  )
}

function getClientKey(client: Client, index: number): string {
  return String(client.NetUid || client.Id || index)
}

function isSelectedClient(client: Client, selectedClientKey: string): boolean {
  return Boolean(selectedClientKey) && String(client.NetUid || client.Id || '') === selectedClientKey
}
