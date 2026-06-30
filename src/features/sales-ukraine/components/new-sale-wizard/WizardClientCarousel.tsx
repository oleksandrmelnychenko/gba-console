import { Box, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import type { RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client } from '../../../clients/types'
import type { WizardClientCarouselState } from './wizardClientStepModel'

export function WizardClientCarousel({
  carousel,
  hasDebt,
  hideName,
  searchInputRef,
  searchMode,
  searchValue,
  selectedClientKey,
  onPickClient,
  onSearchChange,
}: {
  carousel: WizardClientCarouselState
  hasDebt: boolean
  hideName: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
  searchMode: boolean
  searchValue: string
  selectedClientKey: string
  onPickClient: (client: Client) => void
  onSearchChange: (value: string) => void
}) {
  const { t } = useI18n()
  const showInput = searchMode || !carousel.selected

  return (
    <Box className="new-sale-client-drum">
      <Box className="new-sale-client-drum__stack new-sale-client-drum__stack--top">
        <Stack gap={5}>
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

      <Box className="new-sale-client-drum__focus">
        {/* Keep the input mounted while visually hidden so keyboard focus and arrows keep working. */}
        <input
          ref={searchInputRef}
          autoFocus
          className={`new-sale-client-drum__search ${showInput ? '' : 'is-hidden'}`}
          placeholder={t('Місце вводу для пошуку')}
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
        {!showInput && carousel.selected && (
          <ClientMiniCard client={carousel.selected} hasDebt={hasDebt} hideName={hideName} />
        )}
      </Box>

      <Box className="new-sale-client-drum__stack new-sale-client-drum__stack--bottom">
        <Stack gap={5}>
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
  const rowClassName = [
    'new-sale-client-drum-row',
    isSelected ? 'is-selected' : '',
    hasDebt ? 'has-debt' : '',
    client.IsTradePoint ? 'is-trade-point' : '',
    client.IsSubClient ? 'is-sub-client' : '',
  ].filter(Boolean).join(' ')
  const code = client.RegionCode?.Value || client.ClientNumber || client.USREOU || ''

  return (
    <UnstyledButton className={rowClassName} onClick={() => onPick(client)}>
      <Box className="new-sale-client-drum-row__content">
        <Box className="new-sale-client-drum-row__status">
          <Box className={`new-sale-client-drum-row__dot ${hasDebt ? 'is-danger' : client.IsActive ? 'is-active' : ''}`} />
        </Box>
        <Box className="new-sale-client-drum-row__copy">
          {code && (
            <Text className="new-sale-client-drum-row__code" title={code} truncate>
              {code}
            </Text>
          )}
          <Text className="new-sale-client-drum-row__name" title={client.FullName} truncate>
            {client.FullName}
          </Text>
        </Box>
      </Box>
    </UnstyledButton>
  )
}

function ClientMiniCard({ client, hasDebt, hideName }: { client: Client; hasDebt: boolean; hideName: boolean }) {
  const isDebt = hasDebt || (client.ClientInDebts?.length ?? 0) > 0
  const color = isDebt ? 'red.7' : 'orange.7'
  const code = client.RegionCode?.Value || client.ClientNumber || client.USREOU || ''

  return (
    <Box className={`new-sale-client-drum-card ${isDebt ? 'has-debt' : ''}`}>
      <Box className="new-sale-client-drum-card__top">
        <Box className="new-sale-client-drum-card__head">
          {code && (
            <Text className="new-sale-client-drum-card__code" c={color} fw={700}>
              {code}
            </Text>
          )}
        </Box>
        <Box className={`new-sale-client-drum-card__state ${isDebt ? 'has-debt' : client.IsActive ? 'is-active' : ''}`}>
          {isDebt ? <IconAlertTriangle size={14} /> : <IconCircleCheck size={14} />}
        </Box>
      </Box>
      {!hideName && (
        <Tooltip disabled={!client.FullName} label={client.FullName} multiline maw={360}>
          <Text className="new-sale-client-drum-card__name">
            {client.FullName}
          </Text>
        </Tooltip>
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
