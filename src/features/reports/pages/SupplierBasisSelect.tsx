import { Select, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isSupplierBasisCapability } from '../data/supplierBasis'

type Props = { capability: unknown; value: unknown; disabled: boolean; onChange: (value: 0 | 1) => void }

export function SupplierBasisSelect({ capability, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  if (!isSupplierBasisCapability(capability)) return null
  const options = [
    ...(value == null ? [{ value: 'saved', label: t('Збережений спосіб розрахунку') }] : []),
    { value: '0', label: t('Продажі мінус повернення') },
    { value: '1', label: t('Продажі за партіями без повернень') },
  ]
  return <>
    <Select label={t('Розрахунок за постачальниками')} data={options}
      value={value === 0 ? '0' : value === 1 ? '1' : 'saved'}
      disabled={disabled} allowDeselect={false}
      onChange={next => {
        if (next === '0' || next === '1') onChange(next === '0' ? 0 : 1)
      }} />
    {value === 0 ? <Text size="xs" c="dimmed">
      {t('Невизначені постачальник або склад показуються окремо. Недоступні собівартість і прибуток залишаються порожніми, зокрема у підсумках.')}
    </Text> : <Text size="xs" c="dimmed">
      {t('Збережений розрахунок використовує партії продажів. Період із поверненнями недоступний.')}
    </Text>}
  </>
}
