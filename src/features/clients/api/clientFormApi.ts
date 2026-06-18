import { apiRequest } from '../../../shared/api/apiClient'
import { toSaveDiscount } from '../productGroupDiscountPayload'
import type {
  Agreement,
  Client,
  ClientAgreement,
  Currency,
  Organization,
  PriceType,
  Pricing,
  ProviderPricing,
  VatRate,
  ClientUpsertResult,
} from '../types'

const CLIENT_SAVE_OMIT_KEYS = [
  'ClientContractDocuments',
  'ClientInDebts',
  'SubClients',
  'RootClients',
  'RootClient',
  'TotalCurrentAmount',
  'IsClientExpanded',
  'IsSelected',
]

const CLIENT_AGREEMENT_SAVE_OMIT_KEYS = ['Client']
const AGREEMENT_SAVE_OMIT_KEYS = ['ClientAgreements', 'ClientInDebts', 'IsSelected']

export async function getClientById(netId: string): Promise<Client | null> {
  const result = await apiRequest<unknown>('/clients/get', {
    query: {
      netId,
      includeDebts: false,
    },
  })

  return normalizeClient(result)
}

export async function createClient(client: Client, parentId?: string | null): Promise<ClientUpsertResult> {
  const result = await apiRequest<unknown>('/clients/new', {
    method: 'POST',
    query: {
      parentId: parentId || undefined,
    },
    body: prepareClientSavePayload(client),
  })

  return normalizeClient(result)
}

export async function updateClient(client: Client): Promise<ClientUpsertResult> {
  const result = await apiRequest<unknown>('/clients/update', {
    method: 'POST',
    body: prepareClientSavePayload(client),
  })

  return normalizeClient(result)
}

export async function deleteClient(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeClient(result: unknown): Client | null {
  if (result && typeof result === 'object') {
    return result as Client
  }

  return null
}

export function prepareClientSavePayload(client: Client): Client {
  const payload = omitKeys(client, CLIENT_SAVE_OMIT_KEYS)

  if (!Array.isArray(client.ClientAgreements)) {
    return payload
  }

  return {
    ...payload,
    ClientAgreements: client.ClientAgreements.map(prepareClientAgreementSavePayload),
  }
}

function prepareClientAgreementSavePayload(clientAgreement: ClientAgreement): ClientAgreement {
  const basePayload = omitKeys(clientAgreement, CLIENT_AGREEMENT_SAVE_OMIT_KEYS)
  const {
    Agreement: agreement,
    __ProductGroupDiscountsChanged: discountsChanged,
    ProductGroupDiscounts,
    ...clientAgreementPayload
  } = basePayload

  const payload: ClientAgreement = {
    ...clientAgreementPayload,
    ...(agreement ? { Agreement: prepareAgreementSavePayload(agreement) } : {}),
  }

  if (!discountsChanged) {
    return payload
  }

  return {
    ...payload,
    ProductGroupDiscounts: (ProductGroupDiscounts || []).map(toSaveDiscount),
  }
}

function prepareAgreementSavePayload(agreement: Agreement): Agreement {
  const payload = omitKeys(agreement, AGREEMENT_SAVE_OMIT_KEYS)

  return {
    ...payload,
    ...(payload.Currency ? { Currency: compactCurrency(payload.Currency) } : {}),
    ...(payload.Organization ? { Organization: compactOrganization(payload.Organization) } : {}),
    ...(payload.Pricing ? { Pricing: compactPricing(payload.Pricing) } : {}),
    ...(payload.ProviderPricing ? { ProviderPricing: compactProviderPricing(payload.ProviderPricing) } : {}),
    ...(payload.PromotionalPricing ? { PromotionalPricing: compactPricing(payload.PromotionalPricing) } : {}),
  }
}

function compactCurrency(currency: Currency): Currency {
  return {
    Code: currency.Code,
    Id: currency.Id,
    Name: currency.Name,
    NetUid: currency.NetUid,
  }
}

function compactOrganization(organization: Organization): Organization {
  return {
    Code: organization.Code,
    FullName: organization.FullName,
    Id: organization.Id,
    IsIndividual: organization.IsIndividual,
    IsVatAgreements: organization.IsVatAgreements,
    Name: organization.Name,
    NetUid: organization.NetUid,
    SROI: organization.SROI,
    TIN: organization.TIN,
    USREOU: organization.USREOU,
    VatRate: organization.VatRate ? compactVatRate(organization.VatRate) : undefined,
    VatRateId: organization.VatRateId,
  }
}

function compactProviderPricing(providerPricing: ProviderPricing): ProviderPricing {
  return {
    BasePricingId: providerPricing.BasePricingId,
    Currency: providerPricing.Currency ? compactCurrency(providerPricing.Currency) : undefined,
    CurrencyId: providerPricing.CurrencyId,
    Id: providerPricing.Id,
    Name: providerPricing.Name,
    NetUid: providerPricing.NetUid,
    Pricing: providerPricing.Pricing ? compactPricing(providerPricing.Pricing) : undefined,
  }
}

function compactPricing(pricing: Pricing): Pricing {
  return {
    BasePricing: pricing.BasePricing ? compactPricingReference(pricing.BasePricing) : undefined,
    BasePricingId: pricing.BasePricingId,
    Comment: pricing.Comment,
    Currency: pricing.Currency ? compactCurrency(pricing.Currency) : undefined,
    CurrencyId: pricing.CurrencyId,
    ExtraCharge: pricing.ExtraCharge,
    ForVat: pricing.ForVat,
    Id: pricing.Id,
    Name: pricing.Name,
    NetUid: pricing.NetUid,
    PriceType: pricing.PriceType ? compactPriceType(pricing.PriceType) : undefined,
    PriceTypeId: pricing.PriceTypeId,
    SortingPriority: pricing.SortingPriority,
  }
}

function compactPricingReference(pricing: Pricing): Pricing {
  return {
    BasePricingId: pricing.BasePricingId,
    CurrencyId: pricing.CurrencyId,
    Id: pricing.Id,
    Name: pricing.Name,
    NetUid: pricing.NetUid,
    PriceTypeId: pricing.PriceTypeId,
  }
}

function compactPriceType(priceType: PriceType): PriceType {
  return {
    Id: priceType.Id,
    Name: priceType.Name,
    NetUid: priceType.NetUid,
  }
}

function compactVatRate(vatRate: VatRate): VatRate {
  return {
    Id: vatRate.Id,
    NetUid: vatRate.NetUid,
    Value: vatRate.Value,
  }
}

function omitKeys<T extends object>(value: T, keys: readonly string[]): T {
  const payload = { ...(value as Record<string, unknown>) }

  keys.forEach((key) => {
    delete payload[key]
  })

  return payload as T
}
