import { Alert, Box, Button, Group, Stack, Text } from '@mantine/core'
import { CUSTOMER_GROUP_CURRENT_FIELDS_NOTE, CUSTOMER_GROUP_MANAGER_NOTE } from '../data/customerGroupSelections'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { CustomerGroupChoiceControl } from './CustomerGroupChoiceControl'
import { useCustomerGroupChoiceOptions } from './useCustomerGroupChoiceOptions'
function ChoicePageActions({ choices, disabled, label }: {
  choices: ReturnType<typeof useCustomerGroupChoiceOptions>; disabled?: boolean; label?: string
}) {
  if (!choices.more && !choices.failure) return null
  return <Stack gap={4} mt={label ? 24 : 0} style={{ flexShrink: 0 }}>
        {choices.more ? <Button type="button" variant="subtle" size="compact-sm" disabled={disabled || choices.loading} onMouseDown={event => event.preventDefault()} onClick={() => void choices.loadMore()}>Ще значення</Button> : null}
        {choices.failure ? <Button type="button" variant="subtle" size="compact-sm" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => void choices.retry()}>Спробувати ще раз</Button> : null}
      </Stack>
}
export function CustomerGroupExactChoicePicker({ selection, label, disabled, error, onChange, field }: CustomerGroupDirectoryPickerProps & { field: 1 | 8 | 10 }) {
  const choices = useCustomerGroupChoiceOptions(field, disabled)
  return <Stack gap="xs">
    <Group wrap="nowrap" align="flex-start" gap="xs">
      <Box flex={1} miw={0}><CustomerGroupChoiceControl selection={selection} label={label} disabled={disabled} error={error || choices.queryError || undefined}
      onChange={onChange} field={field} options={choices.options} loading={choices.loading} search={choices.search} setSearch={choices.setSearch} /></Box>
      <ChoicePageActions choices={choices} disabled={disabled} label={label} />
    </Group>
    {field === 1 ? <Text size="xs" c="dimmed">Шукайте за назвою або точним ID товару: id:123.</Text> : null}
    {choices.capped ? <Text size="sm">Уточніть пошук, щоб побачити решту значень.</Text> : null}
    {choices.failure ? <Alert color="yellow">Не вдалося завантажити значення. Збережений відбір залишено без змін.</Alert> : null}
    {selection.IsChecked !== false && field !== 1 ? <Text size="sm" c="dimmed">{CUSTOMER_GROUP_CURRENT_FIELDS_NOTE}</Text> : null}
    {selection.IsChecked !== false && field === 10 ? <Text size="sm" c="dimmed">{CUSTOMER_GROUP_MANAGER_NOTE}</Text> : null}
  </Stack>
}
