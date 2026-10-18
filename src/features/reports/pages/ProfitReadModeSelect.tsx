import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { currentProfitMaximumDays, isProfitReadModeCapability, profitReadModeLabel } from '../data/profitReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; hideRegister?: boolean; onChange: (value: 0 | 1 | undefined) => void }

export function ProfitReadModeSelect({ capability, value, disabled, hideRegister = false, onChange }: Props) {
  const { t } = useI18n()
  if (!isProfitReadModeCapability(capability)) return null
  const options = [{ value: '0', label: t(profitReadModeLabel(0)) }, ...(hideRegister && value !== 1 ? [] : [{ value: '1', label: t(profitReadModeLabel(1)), disabled: hideRegister }]),
    ...(hideRegister && (value === 0 || value === 1) ? [] : [{ value: 'saved', label: t('За налаштуваннями звіту'), disabled: hideRegister }])]
  if (hideRegister && options.length <= 1) return null
  return <>
    <Select label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      data={options}
      onChange={next => {
        if (next === '0' || next === '1' || next === 'saved') onChange(next === 'saved' ? undefined : next === '0' ? 0 : 1)
      }} />
    <Text size="xs" c="dimmed">{value === 0
      ? t('Продажі та повернення з документів GBA за період до {days} календарних днів, звірені з 1С. Суми, яких бракує в документах, залишаються порожніми.',
        { days: currentProfitMaximumDays(capability) })
      : t(value === 1 ? 'Розрахунок за збереженими регістрами 1С з підтвердженими відборами Fenix. Нові документи GBA не включаються.'
        : 'Джерело не передається: звіт визначає його за способом розрахунку та відборами, як до появи цього вибору. З підтвердженими відборами Fenix це збережені регістри 1С.')}</Text>
  </>
}
