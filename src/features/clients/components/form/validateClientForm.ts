import type { Client } from '../../types'
import type { ClientFormRole } from './GeneralInfoFields'

export type ClientFormErrors = Partial<Record<string, string>>

type MaxLengthRule = {
  field: string
  value?: string
  max: number
}

export function validateClientForm(client: Client, role: ClientFormRole, tooManyMessage: string): ClientFormErrors {
  const rules: MaxLengthRule[] = [
    { field: 'FullName', value: client.FullName, max: 100 },
    { field: 'EmailAddress', value: client.EmailAddress, max: 100 },
    { field: 'FaxNumber', value: client.FaxNumber, max: 20 },
    { field: 'ActualAddress', value: client.ActualAddress, max: 500 },
  ]

  if (role.isProvider) {
    rules.push(
      { field: 'Brand', value: client.Brand, max: 100 },
      { field: 'SupplierCode', value: client.SupplierCode, max: 100 },
      { field: 'SupplierName', value: client.SupplierName, max: 100 },
      { field: 'IncotermsElse', value: client.IncotermsElse, max: 100 },
    )
  }

  if (role.isBuyer) {
    rules.push(
      { field: 'Name', value: client.Name, max: 100 },
      { field: 'ICQ', value: client.ICQ, max: 20 },
      { field: 'SMSNumber', value: client.SMSNumber, max: 20 },
      { field: 'AccountantNumber', value: client.AccountantNumber, max: 20 },
      { field: 'DirectorNumber', value: client.DirectorNumber, max: 20 },
      { field: 'Manager', value: client.Manager, max: 250 },
      { field: 'DeliveryAddress', value: client.DeliveryAddress, max: 500 },
      { field: 'LegalAddress', value: client.LegalAddress, max: 500 },
    )
  }

  const errors: ClientFormErrors = {}

  rules.forEach((rule) => {
    if (rule.value && rule.value.length > rule.max) {
      errors[rule.field] = tooManyMessage
    }
  })

  return errors
}

export function validateRegionCodeSubmitState(
  isLoadingRegionCode: boolean,
  regionCodeError: string | undefined,
  loadingMessage: string,
): string | undefined {
  if (isLoadingRegionCode) {
    return loadingMessage
  }

  return regionCodeError
}
