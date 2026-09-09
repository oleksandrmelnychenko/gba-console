import { Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { supportsFullReportDateRange } from '../data/nativeReportProfiles'

type Props = { dataSource: number; supported: boolean; from: string; to: string; maxDate: string; onFromChange: (value: string) => void; onToChange: (value: string) => void }
export default function ReportPeriodInputs({ dataSource, supported, from, to, maxDate, onFromChange, onToChange }: Props) {
  const { t } = useI18n()
  return supported ? <div className="app-filter-date-range">
            <TextInput
              label={dataSource === 13 ? 'Поточний період: від' : t('Від')}
              max={to || maxDate}
              min={supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : '2000-01-01'}
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.currentTarget.value)}
            />
            <TextInput
              label={dataSource === 13 ? 'Поточний період: до' : t('До')}
              max={maxDate}
              min={from || (supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : '2000-01-01')}
              type="date"
              value={to}
              onChange={(event) => onToChange(event.currentTarget.value)}
            />
          </div> : <Text size="sm">{dataSource === 19 ? 'Історичні курси на дві дати, задані нижче.' : t('Поточний стан на час читання даних. Історичний період не застосовується.')}</Text>
}
