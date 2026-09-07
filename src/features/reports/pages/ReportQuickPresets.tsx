import { Button, Text, Tooltip } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { SALES_REPORT_PRESETS, type SalesReportPresetId } from '../data/reportPresets'
import './report-quick-presets.css'

type Props = {
  disabled: boolean
  onApply: (id: SalesReportPresetId) => void
}

export function ReportQuickPresets({ disabled, onApply }: Props) {
  const { t } = useI18n()

  return (
    <div className="report-quick-presets" role="group" aria-label={t('Готові налаштування звіту')}>
      <Text className="report-quick-presets__label" size="xs">{t('Готові налаштування')}</Text>
      {SALES_REPORT_PRESETS.map((preset) => (
        <Tooltip key={preset.id} label={t(preset.description)} multiline w={320}>
          <Button
            className="report-quick-presets__option"
            disabled={disabled}
            size="xs"
            type="button"
            variant="default"
            onClick={() => onApply(preset.id)}
          >
            {t(preset.name)}
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}
