import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isSettlementReadModeCapability, settlementReadModeLabel } from '../data/settlementReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; hideRegister?: boolean; onChange: (value: 0) => void }

export function SettlementReadModeSelect({ capability, value, disabled, hideRegister = false, onChange }: Props) {
  const { t } = useI18n()
  if (!isSettlementReadModeCapability(capability) || hideRegister && value === 0) return null
  return <>
    <Select label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : null} placeholder={t('Оберіть джерело розрахунку')}
      data={[{ value: '0', label: t(settlementReadModeLabel(0)) }]}
      onChange={next => { if (next === '0' && value !== 0) onChange(0) }} />
    <Text size="xs" c="dimmed">{t('Документи GBA та початкові залишки з 1С на 01.01.2025 для контрагентів групи «Покупці», звірені з 1С. Період від 01.01.2025 до 120 календарних місяців, включно з сьогодні.')}</Text>
  </>
}
