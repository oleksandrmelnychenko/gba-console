import { Box } from '@mantine/core'
import type { RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client } from '../../../clients/types'
import type { WizardClientCarouselState } from './wizardClientStepModel'
import { WizardClientMiniCard, WizardClientStack } from './WizardClientPickerItems'

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
        <WizardClientStack clients={carousel.dataTop} selectedClientKey={selectedClientKey} onPick={onPickClient} />
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
          <WizardClientMiniCard client={carousel.selected} hasDebt={hasDebt} hideName={hideName} />
        )}
      </Box>

      <Box className="new-sale-client-drum__stack new-sale-client-drum__stack--bottom">
        <WizardClientStack clients={carousel.dataBottom} selectedClientKey={selectedClientKey} onPick={onPickClient} />
      </Box>
    </Box>
  )
}
