import { Badge, Group, Tooltip } from '@mantine/core'
import { procurementOrderTermMarkers } from '../procurementOrderTerm'
import type { ReorderSuggestion } from '../procurementTypes'

export function ProcurementOrderTermMarkers({ item, justify = 'flex-end' }: { item: ReorderSuggestion; justify?: 'flex-end' | 'flex-start' }) {
  const markers = procurementOrderTermMarkers(item)
  if (markers.length === 0) return null

  return (
    <Group data-testid="order-term-markers" gap={4} justify={justify} wrap="wrap">
      {markers.map((marker) => {
        const badge = (
          <Badge
            className="app-role-pill is-gray"
            data-testid={`order-term-${marker.kind}`}
            size="xs"
            variant="light"
          >
            {marker.label}
          </Badge>
        )
        return marker.tooltip ? (
          <Tooltip key={marker.kind} label={marker.tooltip} maw={360} multiline withinPortal>
            {badge}
          </Tooltip>
        ) : (
          <span key={marker.kind}>{badge}</span>
        )
      })}
    </Group>
  )
}
