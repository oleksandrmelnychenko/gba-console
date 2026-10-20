import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { supportsFullReportDateRange } from '../data/nativeReportProfiles'
import type { ReportPeriodPreset } from '../data/bug1274WorkbookGuide'

type Props = { dataSource: number; supported: boolean; from: string; to: string; maxDate: string; disabled?: boolean; presets?: readonly ReportPeriodPreset[]
  onFromChange: (value: string) => void; onToChange: (value: string) => void }
export default function ReportPeriodInputs({ dataSource, supported, from, to, maxDate, disabled = false, presets = [], onFromChange, onToChange }: Props) {
  const { t } = useI18n()
  return supported ? <><ToolbarDateRangeFilter from={from} to={to} max={maxDate}
            min={supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : '2000-01-01'}
            disabled={disabled} fromLabel={dataSource === 13 ? 'Поточний період: від' : t('Від')}
            toLabel={dataSource === 13 ? 'Поточний період: до' : t('До')}
            onChange={range => { onFromChange(range.from); onToChange(range.to) }} />
            {presets.length ? <Select classNames={{ dropdown: 'reports-toolbar-dropdown' }} label={t('Швидкий період')} placeholder={t('Оберіть…')} value={null} disabled={disabled}
              allowDeselect={false} className="reports-period-presets" data={presets.map(preset => ({ value: preset.label, label: t(preset.label) }))}
              onChange={label => {
                const preset = presets.find(item => item.label === label)
                if (!preset) return
                onFromChange(preset.from)
                onToChange(preset.to)
              }} /> : null}
          </> : <Text size="sm">{dataSource === 19 ? 'Історичні курси на дві дати, задані нижче.' : t('Поточний стан на час читання даних. Історичний період не застосовується.')}</Text>
}
