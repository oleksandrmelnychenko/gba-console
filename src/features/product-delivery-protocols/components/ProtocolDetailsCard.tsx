import { Card, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ProtocolDetail } from '../detailTypes'
import { getProtocolPlacementStatusLabel, getProtocolStatusLabel } from '../protocolStatus'
import { LabelValueRow } from './LabelValueRow'
import { formatDate, transportationTypeLabel } from './protocolDetailHelpers'

export function ProtocolDetailsCard({ protocol }: { protocol: ProtocolDetail }) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={700}>
          {t('Протокол ')}
          {protocol.DeliveryProductProtocolNumber?.Number || ''}
        </Text>
        <LabelValueRow label={t('Організація')}>{protocol.Organization?.Name || '-'}</LabelValueRow>
        <LabelValueRow label={t('Тип')}>{transportationTypeLabel(protocol.TransportationType)}</LabelValueRow>
        <LabelValueRow label={t('Від якої дати')}>{formatDate(protocol.FromDate)}</LabelValueRow>
        <LabelValueRow label={t('Статус')}>{getProtocolStatusLabel(protocol, t)}</LabelValueRow>
        <LabelValueRow label={t('Оприходування')}>{getProtocolPlacementStatusLabel(protocol, t)}</LabelValueRow>
        <LabelValueRow label={t('Коментар')}>{protocol.Comment || '-'}</LabelValueRow>
      </Stack>
    </Card>
  )
}
