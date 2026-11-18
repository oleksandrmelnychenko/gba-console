import { Text, Tooltip } from '@mantine/core'
import { Warehouse } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { SalesUkraineOrderItem } from '../../types'
import { formatReservationStorages, getReservationStorages, RESERVATION_STORAGE_RULE } from './wizardCartReservationStorage'

const qty = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

/** Which storage the cart line reserves from, with the priority rule in the tooltip. Renders nothing without a reservation. */
export function WizardCartReservationNote({ item }: { item: SalesUkraineOrderItem }) {
  const { t } = useI18n()
  const text = formatReservationStorages(getReservationStorages(item), (value) => qty.format(value))

  if (!text) return null

  return (
    <Tooltip label={t(RESERVATION_STORAGE_RULE)} maw={360} multiline withArrow>
      <Text aria-label={`${text}. ${t(RESERVATION_STORAGE_RULE)}`} c="dimmed" className="wizard-cart-reservation-note" data-testid="cart-reservation-storage" size="xs" truncate>
        <Warehouse aria-hidden size={12} style={{ marginRight: 4, verticalAlign: '-2px' }} />
        {text}
      </Text>
    </Tooltip>
  )
}
