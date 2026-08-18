import { PermissionKeys } from '../../shared/auth/permissionKeys'

export const EDIT_CLIENT_TYPE_PERMISSION = PermissionKeys.Clients.ClientType.Change
export const EDIT_CLIENT_ACTIVE_PERMISSION = PermissionKeys.Clients.Status.ToggleActive
export const EDIT_CLIENT_DELETE_PERMISSION = PermissionKeys.Clients.Client.Delete
export const EDIT_CLIENT_PERMISSION = PermissionKeys.Clients.Client.Edit
export const EDIT_CLIENT_PRICING_PERMISSION = PermissionKeys.Clients.Pricing.Open
export const EDIT_CLIENT_ECOMMERCE_PERMISSION = PermissionKeys.Clients.Ecommerce.Open
export const CHANGE_CLIENT_ECOMMERCE_PASSWORD_PERMISSION = PermissionKeys.Clients.Ecommerce.ChangePassword
export const EXPORT_CLIENT_AGREEMENT_DOCUMENT_PERMISSION = PermissionKeys.Clients.Contract.ExportDocument
export const CREATE_CLIENT_COUNTRY_PERMISSION = PermissionKeys.ClientResources.Country.Create
export const CREATE_CLIENT_INCOTERM_PERMISSION = PermissionKeys.ClientResources.Incoterm.Create
export const CREATE_CLIENT_REGION_PERMISSION = PermissionKeys.ClientResources.Region.Create

export const DISCOUNT_SELECT_ALL_PERMISSION = PermissionKeys.Clients.Contract.SelectAll
export const DISCOUNT_PERCENT_INPUT_PERMISSION = PermissionKeys.Clients.Promotion.EditText
export const DISCOUNT_ROW_CHECKBOX_PERMISSION = PermissionKeys.Clients.Promotion.Toggle

const CLIENT_TYPE_PERMISSION_BY_ICON: Readonly<Record<string, string>> = {
  client_icon: PermissionKeys.Clients.ClientType.SelectBuyer,
  supplier_icon: PermissionKeys.Clients.ClientType.SelectSupplier,
}

const CLIENT_ROLE_PERMISSION_BY_NAME: Readonly<Record<string, string>> = {
  ShopClient: PermissionKeys.Clients.ClientType.SelectShopClient,
  Постачальникитовару: PermissionKeys.Clients.ClientType.SelectProductSupplier,
  ПокупціПЛ: PermissionKeys.Clients.ClientType.SelectPolishBuyer,
  ПокупціПЛУкраїна: PermissionKeys.Clients.ClientType.SelectPolishUaBuyer,
  ПокупціУкраїна: PermissionKeys.Clients.ClientType.SelectUkraineBuyer,
  Польськіклієнти: PermissionKeys.Clients.ClientType.SelectPolishClient,
}

export function getClientTypePermission(clientTypeIcon?: string) {
  if (!clientTypeIcon) return ''

  return CLIENT_TYPE_PERMISSION_BY_ICON[clientTypeIcon] ?? `${clientTypeIcon}_clientsNew_PKEY`
}

export function getClientTypeRolePermission(roleName?: string) {
  if (!roleName) return ''

  const normalizedRoleName = roleName.replace(/\s/g, '')
  return CLIENT_ROLE_PERMISSION_BY_NAME[normalizedRoleName] ?? `${normalizedRoleName}_sub_clientsNew_PKEY`
}
