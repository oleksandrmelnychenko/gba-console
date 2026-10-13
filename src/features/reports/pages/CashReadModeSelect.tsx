import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { cashReadModeLabel, isCashReadModeCapability } from '../data/cashReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1 | undefined) => void }

export function CashReadModeSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isCashReadModeCapability(capability)) return null
  return <>
    <Select mt="sm" label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      data={[{ value: 'saved', label: t('Збережене налаштування') },
        { value: '0', label: t(cashReadModeLabel(0)) }, { value: '1', label: t(cashReadModeLabel(1)) }]}
      onChange={next => {
        if (next === '0' || next === '1' || next === 'saved') onChange(next === 'saved' ? undefined : next === '0' ? 0 : 1)
      }} />
    <Text size="xs" c="dimmed">{t(value === 0
      ? 'Документи GBA та початкові залишки на 01.01.2025 для банківських рахунків і кас. Період від 01.01.2025 до 120 календарних місяців, включно з сьогодні.'
      : value === 1 ? 'Розрахунок за збереженими регістрами 1С для банківських рахунків і кас. Нові документи GBA не включаються.'
      : 'Джерело визначається збереженими налаштуваннями звіту. Для поточних документів GBA оберіть їх явно.')}</Text>
  </>
}
