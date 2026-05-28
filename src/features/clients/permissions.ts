export const EDIT_CLIENT_TYPE_PERMISSION = 'EditClient_HEADER_EditClientHeaderClientType_PKEY'
export const EDIT_CLIENT_ACTIVE_PERMISSION = 'EditClient_HEADER_ActiveCheck_PKEY'
export const EDIT_CLIENT_DELETE_PERMISSION = 'EditClient_HEADER_OnDelete_PKEY'
export const EDIT_CLIENT_PRICING_PERMISSION = 'EditClient_Body_EditClientPricingView_PKEY'
export const EDIT_CLIENT_ECOMMERCE_PERMISSION = 'EditClient_Body_EditClientEcommerceView_PKEY'

export const DISCOUNT_SELECT_ALL_PERMISSION = 'Clients_Select_All_Contract_Pricing_Btn_PKEY'
export const DISCOUNT_PERCENT_INPUT_PERMISSION = 'Clients_Select_All_Contract_Pricing_Input_PKEY'
export const DISCOUNT_ROW_CHECKBOX_PERMISSION = 'Clients_Select_All_Contract_Pricing_CheckBox_Btn_PKEY'

export function getClientTypePermission(clientTypeIcon?: string) {
  return clientTypeIcon ? `${clientTypeIcon}_clientsNew_PKEY` : ''
}

export function getClientTypeRolePermission(roleName?: string) {
  return roleName ? `${roleName.replace(/\s/g, '')}_sub_clientsNew_PKEY` : ''
}
