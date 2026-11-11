import { CUSTOMER_GROUP_WAREHOUSE_NOTE } from '../data/customerGroupWarehouse'
import { CUSTOMER_GROUP_PRODUCT_GROUP_NOTE } from '../data/customerGroupProductGroup'
import { CUSTOMER_GROUP_AGREEMENT_NOTE } from '../data/customerGroupAgreement'
import { Stack, Text } from '@mantine/core'
import { CUSTOMER_GROUP_CURRENT_FIELDS_NOTE, CUSTOMER_GROUP_MANAGER_NOTE, type CustomerGroupExactChoiceField } from '../data/customerGroupSelections'
import { CUSTOMER_GROUP_AUTHOR_NOTE } from '../data/customerGroupAuthors'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { CustomerGroupChoiceControl } from './CustomerGroupChoiceControl'
import { useCustomerGroupChoiceOptions } from './useCustomerGroupChoiceOptions'
const CHOICE_BUSINESS_HELP: Partial<Record<number, string>> = {
  4: CUSTOMER_GROUP_PRODUCT_GROUP_NOTE,
  21: CUSTOMER_GROUP_WAREHOUSE_NOTE,
  8: CUSTOMER_GROUP_CURRENT_FIELDS_NOTE,
  9: CUSTOMER_GROUP_AGREEMENT_NOTE,
  10: CUSTOMER_GROUP_CURRENT_FIELDS_NOTE,
  15: CUSTOMER_GROUP_AUTHOR_NOTE,
  16: CUSTOMER_GROUP_AUTHOR_NOTE,
}
function ChoiceBusinessHelp({field, active}: {field: number; active: boolean}) {
  if (!active) return null
  const note = CHOICE_BUSINESS_HELP[field]
  return <>{note ? <Text size="sm" c="dimmed">{note}</Text> : null}
    {field === 10 ? <Text size="sm" c="dimmed">{CUSTOMER_GROUP_MANAGER_NOTE}</Text> : null}</>
}
export function CustomerGroupExactChoicePicker({ selection, label, disabled, error, onChange, field }: CustomerGroupDirectoryPickerProps & { field: CustomerGroupExactChoiceField }) {
  const choices = useCustomerGroupChoiceOptions(field, disabled)
  return <Stack gap="xs">
    <CustomerGroupChoiceControl selection={selection} label={label} disabled={disabled} error={error}
      onChange={onChange} field={field} choices={choices} />
    {field === 4 ? <Text size="xs" c="dimmed">Шукайте за назвою або точним ID групи: id:123.</Text> : null}
    {field === 21 ? <Text size="xs" c="dimmed">Шукайте за назвою або точним ID складу: id:123.</Text> : null}
    {field === 9 ? <Text size="xs" c="dimmed">Шукайте за клієнтом, назвою, номером або точним ID договору: id:123.</Text> : null}
    {field === 1 ? <Text size="xs" c="dimmed">Шукайте за назвою або точним ID товару: id:123.</Text> : null}
    {field === 15 || field === 16 ? <Text size="xs" c="dimmed">Шукайте користувача за ім’ям або точним ID: id:123.</Text> : null}
    {choices.capped ? <Text size="sm">Уточніть пошук, щоб побачити решту значень.</Text> : null}
    <ChoiceBusinessHelp field={field} active={selection.IsChecked !== false}/>
  </Stack>
}
