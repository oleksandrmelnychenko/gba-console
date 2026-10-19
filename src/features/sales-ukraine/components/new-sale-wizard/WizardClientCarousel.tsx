import { Box, Stack, Text, UnstyledButton } from '@mantine/core'
import { UserRound } from 'lucide-react'
import { TableChip } from '../../../../shared/ui/TableChip'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client } from '../../../clients/types'
import type { WizardClientCarouselState } from './wizardClientStepModel'

// Keystrokes settle locally for this long before the value is lifted to the
// parent step — re-rendering the 1300-line client step per keystroke is what
// made typing feel laggy.
const SEARCH_LIFT_DEBOUNCE_MS = 160

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
  // Local input text: typing re-renders only the drum; the parent step receives
  // the value once per SEARCH_LIFT_DEBOUNCE_MS pause.
  const [text, setText] = useState(searchValue)
  const lastLiftedRef = useRef(searchValue)
  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt external resets (e.g. the step clears the query on client pick).
  useEffect(() => {
    if (searchValue === lastLiftedRef.current) {
      return
    }

    lastLiftedRef.current = searchValue
    setText((current) => (current === searchValue ? current : searchValue))
  }, [searchValue])

  useEffect(() => () => {
    if (liftTimerRef.current) {
      clearTimeout(liftTimerRef.current)
    }
  }, [])

  function handleTextChange(value: string) {
    setText(value)

    if (liftTimerRef.current) {
      clearTimeout(liftTimerRef.current)
    }

    liftTimerRef.current = setTimeout(() => {
      liftTimerRef.current = null
      lastLiftedRef.current = value
      onSearchChange(value)
    }, SEARCH_LIFT_DEBOUNCE_MS)
  }

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
          value={text}
          onChange={(event) => handleTextChange(event.currentTarget.value)}
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
}

function ClientMiniCard({ client, hasDebt, hideName }: { client: Client; hasDebt: boolean; hideName: boolean }) {
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
}

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
