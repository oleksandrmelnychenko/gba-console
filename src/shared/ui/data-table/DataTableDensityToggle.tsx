import { ActionIcon, Tooltip } from '@mantine/core'
import { IconBaselineDensityMedium, IconBaselineDensitySmall } from '@tabler/icons-react'
import { useI18n } from '../../i18n/useI18n'
import type { DataTableDensity } from './types'

type DataTableDensityToggleProps = {
  density: DataTableDensity
  onToggle: () => void
  /** ActionIcon size; defaults to 36 to match the other control-row icons. */
  size?: number | string
}

/**
 * Compact/normal row-density toggle icon meant to sit in a page's existing
 * control row (next to refresh / reset / export icons), keeping every control
 * on a single line.
 */
export function DataTableDensityToggle({ density, onToggle, size = 36 }: DataTableDensityToggleProps) {
  const { t } = useI18n()

  return (
    <Tooltip label={density === 'compact' ? t('Звичайні рядки') : t('Компактні рядки')}>
      <ActionIcon
        variant="light"
        color="gray"
        size={size}
        aria-label={t('Щільність рядків')}
        onClick={onToggle}
      >
        {density === 'compact' ? <IconBaselineDensitySmall size={18} /> : <IconBaselineDensityMedium size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}
