import { Select, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { supportsFullReportDateRange } from '../data/nativeReportProfiles'
import type { ReportPeriodPreset } from '../data/bug1274WorkbookGuide'

type Props = { dataSource: number; supported: boolean; from: string; to: string; maxDate: string; disabled?: boolean; presets?: readonly ReportPeriodPreset[]
  onFromChange: (value: string) => void; onToChange: (value: string) => void }
export default function ReportPeriodInputs({ dataSource, supported, from, to, maxDate, disabled = false, presets = [], onFromChange, onToChange }: Props) {
  const { t } = useI18n()
  return supported ? <div className="app-filter-date-range">
            <TextInput
              label={dataSource === 13 ? 'Поточний період: від' : t('Від')}
              max={to || maxDate}
              min={supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : '2000-01-01'}
              type="date"
              disabled={disabled}
              value={from}
              onChange={(event) => onFromChange(event.currentTarget.value)}
            />
            <TextInput
              label={dataSource === 13 ? 'Поточний період: до' : t('До')}
              max={maxDate}
              min={from || (supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : '2000-01-01')}
              type="date"
              disabled={disabled}
              value={to}
              onChange={(event) => onToChange(event.currentTarget.value)}
            />
            {presets.length ? <Select label={t('Швидкий період')} placeholder={t('Оберіть…')} value={null} disabled={disabled}
              allowDeselect={false} w={170} data={presets.map(preset => ({ value: preset.label, label: t(preset.label) }))}
              onChange={label => {
                const preset = presets.find(item => item.label === label)
                if (!preset) return
                onFromChange(preset.from)
                onToChange(preset.to)
              }} /> : null}
          </div> : <Text size="sm">{dataSource === 19 ? 'Історичні курси на дві дати, задані нижче.' : t('Поточний стан на час читання даних. Історичний період не застосовується.')}</Text>
}
