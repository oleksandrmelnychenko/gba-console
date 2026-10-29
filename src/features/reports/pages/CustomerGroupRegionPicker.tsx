import { Stack, Text } from '@mantine/core'
import { getCustomerGroupRegions } from '../api/customerGroupRegionsApi'
import { CUSTOMER_GROUP_REGION_NOTE } from '../data/customerGroupRegion'
import { CustomerGroupDirectoryPicker, type CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
const directory = { load: getCustomerGroupRegions, missing: 'Регіон клієнта не визначено', search: 'Пошук регіону клієнта',
  remove: 'Видалити регіон клієнта', failure: 'Не вдалося завантажити регіони клієнтів. Збережений відбір залишено без змін.' }
export function CustomerGroupRegionPicker(props: CustomerGroupDirectoryPickerProps) {
  return <Stack gap="xs"><CustomerGroupDirectoryPicker {...props} directory={directory} />
    {props.selection.IsChecked !== false ? <Text size="sm" c="dimmed">{CUSTOMER_GROUP_REGION_NOTE}</Text> : null}</Stack>
}
