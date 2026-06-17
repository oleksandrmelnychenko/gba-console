import { Tooltip } from '@mantine/core'
import { createConsoleTableMarker } from './console-table-utils'

type ConsoleTableEntityCellProps = {
  marker?: string
  subtitle?: string
  title: string
}

export function ConsoleTableEntityCell({ marker, subtitle, title }: ConsoleTableEntityCellProps) {
  const tooltip = [title, subtitle].filter(Boolean).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <div className="console-table-entity-cell">
        <span className="console-table-entity-marker" aria-hidden="true">
          {marker || createConsoleTableMarker(title)}
        </span>
        <span className="console-table-entity-copy">
          <span className="console-table-entity-title">{title}</span>
          {subtitle ? <span className="console-table-entity-subtitle">{subtitle}</span> : null}
        </span>
      </div>
    </Tooltip>
  )
}
