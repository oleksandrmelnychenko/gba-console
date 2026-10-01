import { Select } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isDayOrganizationBasisCapability } from '../data/dayOrganizationBasis'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1) => void }

export function DayOrganizationBasisSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isDayOrganizationBasisCapability(capability)) return null
  const options = [
    ...(value == null ? [{ value: 'saved', label: t('Збережений спосіб розрахунку') }] : []),
    { value: '0', label: t('Продажі за період') },
    { value: '1', label: t('Продажі з поверненнями за день') },
  ]
  return <Select label={t('Розрахунок валового прибутку')} data={options}
    value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
    disabled={disabled} allowDeselect={false}
    onChange={next => {
      if (next === '0' || next === '1') onChange(next === '0' ? 0 : 1)
    }} />
}
