import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core'
import { ArrowDown, ArrowLeftRight, ArrowUp, Plus } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { canTransferReportGrouping, type ReportGroupingAxis, type ReportGroupingLayout } from '../data/reportGroupingLayout'
import { getReportFieldLabel } from '../data/reportOptions'

type Props = {
  layout: ReportGroupingLayout
  axis: ReportGroupingAxis
  allowed: ReadonlySet<number>
  onOpenPicker: () => void
  onRemove: (index: number) => void
  onReorder: (type: number, direction: -1 | 1) => void
  onTransfer: (type: number) => void
}

export function ReportGroupingPanel({ layout, axis, allowed, onOpenPicker, onRemove, onReorder, onTransfer }: Props) {
  const { t } = useI18n()
  const isRows = axis === 'Row', groups = layout[axis]
  const title = isRows ? 'Групування рядків' : 'Групування стовпців'
  return <section className="reports-stocks-grouping-field" aria-label={t(title)}>
    <div className="reports-stocks-legacy-panel__header">
      <Group className="reports-stocks-legacy-panel__title" gap={6} wrap="nowrap">
        <Text className="reports-stocks-grouping-label" component="h3" fw={600} size="sm">{t(isRows ? 'Рядки' : 'Стовпці')}</Text>
        <Text className="reports-stocks-grouping-requirement" size="xs">{isRows ? t('Обов’язково') : t('Необов’язково')}</Text>
      </Group>
      <Button aria-label={`Додати поле: ${title}`} className="reports-stocks-legacy-panel__add" color={CREATE_ACTION_COLOR}
        leftSection={<Plus size={14} />} size="xs" type="button" onClick={onOpenPicker}>Додати</Button>
    </div>
    <div className="reports-stocks-legacy-group-list">
      {groups.length ? groups.map((group, index) => {
        const label = group.label || getReportFieldLabel(group.key)
        const uniqueSupported = allowed.has(group.type) && groups.filter(item => item.type === group.type).length === 1
        const transferLabel = t(isRows ? 'Перенести {field} до стовпців' : 'Перенести {field} до рядків', { field: label })
        return <div className="reports-stocks-legacy-group-row" key={`${group.type}-${groups.slice(0, index).filter(item => item.type === group.type).length}`}>
          <span className="reports-stocks-group-position" aria-label={t('Рівень {level}', { level: index + 1 })}>{index + 1}</span>
          <Text size="sm">{label}</Text>
          <Group gap={0} wrap="nowrap">
            <Tooltip label={t('Перемістити {field} вище', { field: label })}><ActionIcon type="button" variant="subtle" color="gray" size={28}
              aria-label={t('Перемістити {field} вище', { field: label })} disabled={!uniqueSupported || index === 0} onClick={() => onReorder(group.type, -1)}><ArrowUp size={15} /></ActionIcon></Tooltip>
            <Tooltip label={t('Перемістити {field} нижче', { field: label })}><ActionIcon type="button" variant="subtle" color="gray" size={28}
              aria-label={t('Перемістити {field} нижче', { field: label })} disabled={!uniqueSupported || index === groups.length - 1} onClick={() => onReorder(group.type, 1)}><ArrowDown size={15} /></ActionIcon></Tooltip>
            <Tooltip label={isRows && groups.length === 1 ? t('Залиште принаймні одне групування рядків') : transferLabel}><ActionIcon type="button" variant="subtle" color="gray" size={28}
              aria-label={transferLabel} disabled={!canTransferReportGrouping(layout, axis, group.type, allowed)} onClick={() => onTransfer(group.type)}><ArrowLeftRight size={15} /></ActionIcon></Tooltip>
            <TableRowAction action="delete" label={t('Видалити {field}', { field: label })} onClick={() => onRemove(index)} />
          </Group>
        </div>
      }) : <div className="reports-stocks-legacy-group-list__empty"><Text size="sm" c="gray.9">{isRows ? t('Додайте день, товар або інше поле') : t('Без поділу на стовпці')}</Text></div>}
    </div>
  </section>
}
