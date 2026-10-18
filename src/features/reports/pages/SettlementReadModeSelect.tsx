import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isSettlementReadModeCapability, settlementReadModeLabel } from '../data/settlementReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; hideRegister?: boolean; onChange: (value: 0 | 1 | undefined) => void }

export function SettlementReadModeSelect({ capability, value, disabled, hideRegister = false, onChange }: Props) {
  const { t } = useI18n()
  if (!isSettlementReadModeCapability(capability)) return null
  const options = [{ value: '0', label: t(settlementReadModeLabel(0)) }, ...(hideRegister && value !== 1 ? [] : [{ value: '1', label: t(settlementReadModeLabel(1)), disabled: hideRegister }]),
    ...(hideRegister && (value === 0 || value === 1) ? [] : [{ value: 'saved', label: t('За налаштуваннями звіту'), disabled: hideRegister }])]
  return <>
    {hideRegister && options.length <= 1 ? null : <Select label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      data={options}
      onChange={next => {
        if (next === '0' || next === '1' || next === 'saved') onChange(next === 'saved' ? undefined : next === '0' ? 0 : 1)
      }} />}
    <Text size="xs" c="dimmed">{t(value === 0
      ? 'Документи GBA та початкові залишки з 1С на 01.01.2025 для контрагентів групи «Покупці», звірені з 1С. Період від 01.01.2025 до 120 календарних місяців, включно з сьогодні.'
      : value === 1 ? 'Розрахунок за збереженими регістрами 1С для бази Fenix і групи «Покупці». Нові документи GBA не включаються.'
      : 'Джерело не передається: звіт визначає його за налаштуваннями, як до появи цього вибору. Цей варіант потрібен для бази AMG або форми без групи «Покупці».')}</Text>
  </>
}
