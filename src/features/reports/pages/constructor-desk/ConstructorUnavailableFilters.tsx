import { Checkbox, Text, Tooltip } from '@mantine/core'

export const NO_GBA_DATA_FILTER_HINT = 'немає даних у GBA'

export function unavailableConstructorFilters(dataSource: number | null | undefined, reportProfile?: string | null): readonly string[] {
  if (dataSource === 2 && reportProfile === 'sales') return ['Проєкт', 'Підрозділ']
  if (dataSource === 46) return ['Проєкт', 'Підрозділ']
  if (dataSource === 44) return ['Підрозділ']
  return []
}

export function ConstructorUnavailableFilters({ fields }: { fields: readonly string[] }) {
  if (!fields.length) return null
  return <div className="constructor-filters__unavailable" aria-label="Недоступні відбори">
    {fields.map(field => <Tooltip key={field} label={NO_GBA_DATA_FILTER_HINT}>
      <div className="constructor-selection-row" data-unavailable-filter={field} aria-disabled="true" title={NO_GBA_DATA_FILTER_HINT}>
        <div className="constructor-selection-row__check"><Checkbox size="xs" disabled checked={false} aria-label={`${field}: ${NO_GBA_DATA_FILTER_HINT}`} readOnly /></div>
        <Text size="sm" c="dimmed">{field}</Text>
        <Text size="sm" c="dimmed">Рівно</Text>
        <Text size="sm" c="dimmed">{NO_GBA_DATA_FILTER_HINT}</Text>
        <span />
      </div>
    </Tooltip>)}
  </div>
}
