import { getCustomerGroupOrganizations } from '../api/customerGroupOrganizationsApi'
import { CustomerGroupDirectoryPicker, type CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
const directory = { load: getCustomerGroupOrganizations, missing: 'Організацію не визначено', search: 'Пошук організації',
  remove: 'Видалити організацію', failure: 'Не вдалося завантажити організації. Збережений відбір залишено без змін.' }
export function CustomerGroupOrganizationPicker(props: CustomerGroupDirectoryPickerProps) {
  return <CustomerGroupDirectoryPicker {...props} directory={directory} />
}
