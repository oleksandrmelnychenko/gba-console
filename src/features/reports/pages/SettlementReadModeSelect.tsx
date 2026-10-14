import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isSettlementReadModeCapability, settlementReadModeLabel } from '../data/settlementReadMode'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1 | undefined) => void }

export function SettlementReadModeSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isSettlementReadModeCapability(capability)) return null
  return <>
    <Select label={t('Джерело розрахунку')} allowDeselect={false} disabled={disabled}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      data={[{ value: '0', label: t(settlementReadModeLabel(0)) }, { value: '1', label: t(settlementReadModeLabel(1)) },
        { value: 'saved', label: t('За налаштуваннями звіту') }]}
      onChange={next => {
        if (next === '0' || next === '1' || next === 'saved') onChange(next === 'saved' ? undefined : next === '0' ? 0 : 1)
      }} />
    <Text size="xs" c="dimmed">{t(value === 0
      ? 'Типове джерело: документи GBA та початкові залишки на 01.01.2025 для всієї групи «Покупці» бази Fenix, без додаткових відборів. Період від 01.01.2025 до 120 календарних місяців, включно з сьогодні.'
      : value === 1 ? 'Розрахунок за збереженими регістрами 1С для бази Fenix і групи «Покупці». Нові документи GBA не включаються.'
      : 'Джерело не передається: звіт визначає його за налаштуваннями, як до появи цього вибору. Цей варіант потрібен для бази AMG або форми без групи «Покупці».')}</Text>
  </>
}
