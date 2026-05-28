import { apiRequest } from '../../../shared/api/apiClient'
import {
  getClientDeliveryRecipients,
  getClientGroups,
  getClientWorkplaces,
} from './clientLookupsApi'
import type {
  Client,
  ClientAgreement,
  ClientGroup,
  ClientOrderedProduct,
  ClientSubClient,
  ClientUpsertResult,
  ClientWorkplace,
  DeliveryRecipient,
  DeliveryRecipientAddress,
  ServicePayer,
} from '../types'

export {
  getClientDeliveryRecipients,
  getClientGroups,
  getClientWorkplaces,
}

export async function createClientGroup(name: string, clientId: number): Promise<ClientGroup | null> {
  const result = await apiRequest<unknown>('/clients/new/group', {
    method: 'POST',
    query: {
      name: name || '',
    },
    body: {
      Name: name,
      ClientId: clientId,
    },
  })

  return normalizeCabinetItem<ClientGroup>(result)
}

export async function changeClientGroup(group: ClientGroup): Promise<ClientGroup | null> {
  const result = await apiRequest<unknown>('/clients/update/client/group', {
    method: 'POST',
    body: group,
  })

  return normalizeCabinetItem<ClientGroup>(result)
}

export async function deleteClientGroup(group: ClientGroup): Promise<ClientGroup | null> {
  return changeClientGroup({
    ...group,
    Deleted: true,
  } as ClientGroup)
}

export async function createClientWorkplace(workplace: ClientWorkplace): Promise<ClientWorkplace | null> {
  const result = await apiRequest<unknown>('/clients/new/workplace', {
    method: 'POST',
    body: workplace,
  })

  return normalizeCabinetItem<ClientWorkplace>(result)
}

export async function updateClientWorkplace(workplace: ClientWorkplace): Promise<ClientWorkplace | null> {
  const result = await apiRequest<unknown>('/clients/update/workplace', {
    method: 'POST',
    body: workplace,
  })

  return normalizeCabinetItem<ClientWorkplace>(result)
}

export async function removeClientWorkplace(netId: string): Promise<ClientWorkplace | null> {
  const result = await apiRequest<unknown>('/clients/remove/workplace', {
    method: 'POST',
    query: {
      netId,
    },
    body: {},
  })

  return normalizeCabinetItem<ClientWorkplace>(result)
}

export async function getClientDeliveryRecipientsWithDeleted(netId: string): Promise<DeliveryRecipient[]> {
  const result = await apiRequest<unknown>('/deliveries/recipients/all/client/deleted', {
    query: {
      netId,
    },
  })

  return normalizeCabinetList<DeliveryRecipient>(result)
}

export async function createDeliveryRecipient(recipient: DeliveryRecipient): Promise<DeliveryRecipient | null> {
  const result = await apiRequest<unknown>('/deliveries/recipients/new', {
    method: 'POST',
    body: recipient,
  })

  return normalizeCabinetItem<DeliveryRecipient>(result)
}

export async function createDeliveryRecipientAddress(
  address: DeliveryRecipientAddress,
): Promise<DeliveryRecipientAddress | null> {
  const result = await apiRequest<unknown>('/deliveries/recipients/addresses/new', {
    method: 'POST',
    body: address,
  })

  return normalizeCabinetItem<DeliveryRecipientAddress>(result)
}

export async function removeDeliveryRecipient(netId: string): Promise<DeliveryRecipient | null> {
  const result = await apiRequest<unknown>('/deliveries/recipients/remove', {
    query: {
      netId,
    },
  })

  return normalizeCabinetItem<DeliveryRecipient>(result)
}

export async function searchServicePayers(
  value: string,
  limit: number,
  offset: number,
): Promise<ServicePayer[]> {
  const result = await apiRequest<unknown>('/clients/payers/search/all', {
    query: {
      value,
      limit,
      offset,
    },
  })

  return normalizeCabinetList<ServicePayer>(result)
}

export async function getClientSubClients(netId: string): Promise<ClientSubClient[]> {
  const result = await apiRequest<unknown>('/clients/all/clientsubclients/client', {
    query: {
      netId,
    },
  })

  return normalizeCabinetList<ClientSubClient>(result)
}

export async function getRootClientBySubClientNetId(netId: string): Promise<Client | null> {
  const result = await apiRequest<unknown>('/clients/get/subclient', {
    query: {
      netId,
    },
  })

  return normalizeCabinetItem<Client>(result)
}

export async function getSubClientAgreements(netId: string): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/clients/clientagreements/all/sub/client', {
    query: {
      netId,
    },
  })

  return normalizeCabinetList<ClientAgreement>(result)
}

export async function getClientOrderedProducts(netId: string): Promise<ClientOrderedProduct[]> {
  const result = await apiRequest<unknown>('/clients/get/orders/items', {
    query: {
      netId,
    },
  })

  return normalizeCabinetList<ClientOrderedProduct>(result)
}

export async function changeClientPassword(
  netId: string,
  password: string,
  mobileNumber: string,
): Promise<ClientUpsertResult> {
  const result = await apiRequest<unknown>('/clients/update/password', {
    method: 'PATCH',
    query: {
      netId,
      password,
      mobileNumber,
    },
  })

  return normalizeCabinetItem<Client>(result)
}

export async function uploadClientContract(
  client: Client,
  documents: File[],
): Promise<ClientUpsertResult> {
  const formData = new FormData()

  documents.forEach((document) => {
    formData.append('documents', document)
  })

  formData.append('client', JSON.stringify(client))

  const result = await apiRequest<unknown>('/clients/documents/upload/contracts', {
    method: 'POST',
    body: formData,
  })

  return normalizeCabinetItem<Client>(result)
}

function normalizeCabinetList<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object') {
    const items = (result as { Items?: unknown }).Items

    if (Array.isArray(items)) {
      return items as T[]
    }
  }

  return []
}

function normalizeCabinetItem<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as T
}
