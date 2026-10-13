import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isProfitReadModeCapability, profitReadModeLabel } from '../data/profitReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1 | undefined) => void }

export function ProfitReadModeSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isProfitReadModeCapability(capability)) return null
  return <>
    <Select label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      data={[{ value: 'saved', label: t('Збережений / автоматичний режим') },
        { value: '0', label: t(profitReadModeLabel(0)) }, { value: '1', label: t(profitReadModeLabel(1)) }]}
      onChange={next => {
        if (next === '0' || next === '1' || next === 'saved') onChange(next === 'saved' ? undefined : next === '0' ? 0 : 1)
      }} />
    <Text size="xs" c="dimmed">{t(value === 0
      ? 'Продажі та повернення з поточних документів GBA за вибраний період. Повна відповідність 1С ще не підтверджена; недоступні суми залишаються порожніми.'
      : value === 1 ? 'Розрахунок за збереженими регістрами 1С з підтвердженими відборами Fenix. Нові документи GBA не включаються.'
      : 'Збережено попередній вибір джерела за налаштуваннями звіту. Для поточних документів GBA оберіть їх явно.')}</Text>
  </>
}
