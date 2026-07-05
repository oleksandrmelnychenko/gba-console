import { Badge, Card, Group, Stack, Text } from '@mantine/core'
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
        <Group gap="xs">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Протокол')}
          </Text>
          {protocol.DeliveryProductProtocolNumber?.Number && (
            <Badge className="app-role-pill is-yellow" variant="light">
              {protocol.DeliveryProductProtocolNumber.Number}
            </Badge>
          )}
        </Group>
        <LabelValueRow label={t('Організація')}>{protocol.Organization?.Name || ''}</LabelValueRow>
        <LabelValueRow label={t('Тип')}>{transportationTypeLabel(protocol.TransportationType)}</LabelValueRow>
        <LabelValueRow label={t('Від якої дати')} mono>{formatDate(protocol.FromDate)}</LabelValueRow>
        <LabelValueRow label={t('Статус')}>
          <Badge className={`app-role-pill ${protocol.IsCompleted ? 'is-green' : 'is-gray'}`} variant="light">
            {getProtocolStatusLabel(protocol, t)}
          </Badge>
        </LabelValueRow>
        <LabelValueRow label={t('Оприходування')}>
          <Badge
            className={`app-role-pill ${protocol.IsPlaced ? 'is-green' : protocol.IsPartiallyPlaced ? 'is-yellow' : 'is-gray'}`}
            variant="light"
          >
            {getProtocolPlacementStatusLabel(protocol, t)}
          </Badge>
        </LabelValueRow>
        <LabelValueRow label={t('Коментар')}>{protocol.Comment || ''}</LabelValueRow>
      </Stack>
    </Card>
  )
}
