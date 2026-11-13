import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { cashReadModeLabel, isCashReadModeCapability } from '../data/cashReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0) => void }

export function CashReadModeSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isCashReadModeCapability(capability) || value === 0) return null
  return <>
    <Select mt="sm" label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : null} placeholder={t('Оберіть джерело розрахунку')}
      data={[{ value: '0', label: t(cashReadModeLabel(0)) }]}
      onChange={next => { if (next === '0' && value !== 0) onChange(0) }} />
    <Text size="xs" c="dimmed">{t('Документи GBA та початкові залишки з 1С на 01.01.2025 для банківських рахунків і кас, звірені з 1С. Період від 01.01.2025 до 120 календарних місяців, включно з сьогодні.')}</Text>
  </>
}
