import { Select, type SelectProps } from '@mantine/core'
import { constructorConditionLabel } from '../data/constructorDesk'

const labels = ['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі']
const unavailable = 'Цей тип порівняння недоступний для вибраного поля у цьому звіті.'
const availabilityNotice = 'Доступність порівнянь залежить від поля та звіту. Для групових умов потрібне поле з ієрархією груп.'

type Props = Omit<SelectProps, 'data'> & {
  data: { value: string; label: string; disabled?: boolean }[]
  constructorLabels?: boolean
}

export function ReportComparisonSelect({ data, constructorLabels = false, description, ...props }: Props) {
  const options = labels.map((label, type) => data.find(option => option.value === String(type)) ?? {
    value: String(type), label: constructorLabels ? constructorConditionLabel(type, label) : label, disabled: true,
  })
  return <Select {...props} data={options}
    description={description ?? (options.some(option => option.disabled) ? availabilityNotice : undefined)}
    renderOption={({ option }) => <span title={option.disabled ? unavailable : undefined}>{option.label}</span>} />
}
