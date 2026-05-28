import { apiRequest } from '../../../shared/api/apiClient'
import type {
  OnlineShopClient,
  OnlineShopPaymentRegister,
  OnlineShopStorage,
  SeoContact,
  SeoContactInfo,
  SeoLocaleEntry,
  SeoLocaleSettings,
  SeoPage,
  SeoRetailPaymentInfo,
  SeoSettingsByLocale,
} from '../types'

export async function getOnlineShopSeoSettings(): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/all')

  return normalizeSeoSettings(result)
}

export async function updateSeoPage(page: SeoPage): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/page/update/locale', {
    method: 'POST',
    body: page,
  })

  return normalizeSeoSettings(result)
}

export async function updateSeoContactInfo(contactInfo: SeoContactInfo): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contactinfo/update', {
    method: 'POST',
    body: contactInfo,
  })

  return normalizeSeoSettings(result)
}

export async function updateSeoPaymentInfo(paymentInfo: SeoRetailPaymentInfo): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/retail/payment/update', {
    method: 'POST',
    body: paymentInfo,
  })

  return normalizeSeoSettings(result)
}

export async function createSeoContact(contact: SeoContact): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/add', {
    method: 'POST',
    body: contact,
  })

  return normalizeSeoSettings(result)
}

export async function uploadSeoContactImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('img', file)

  const result = await apiRequest<unknown>('/seo/info/contacts/img/add', {
    method: 'POST',
    body: formData,
  })

  return typeof result === 'string' ? result : ''
}

export async function updateSeoContact(contact: SeoContact): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/update', {
    method: 'POST',
    body: contact,
  })

  return normalizeSeoSettings(result)
}

export async function removeSeoContact(netId: string): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/remove', {
    method: 'POST',
    query: { netId },
  })

  return normalizeSeoSettings(result)
}

export async function getOnlineShopClients(): Promise<OnlineShopClient[]> {
  const result = await apiRequest<unknown>('/clients/all/shop')

  return normalizeCollection<OnlineShopClient>(result)
}

export async function toggleOnlineShopClient(netId: string): Promise<OnlineShopClient[]> {
  const result = await apiRequest<unknown>('/clients/retail/set', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopClient>(result)
}

export async function getOnlineShopPaymentRegisters(): Promise<OnlineShopPaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/all/retail')

  return normalizeCollection<OnlineShopPaymentRegister>(result)
}

export async function selectOnlineShopPaymentRegister(netId: string): Promise<OnlineShopPaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/select', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopPaymentRegister>(result)
}

export async function getEcommerceStorages(): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/all/ecommerce')

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function getAllOnlineShopStorages(): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/all')

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function addEcommerceStorage(netId: string): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/ecommerce/set', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function removeEcommerceStorage(netId: string): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/ecommerce/unselect', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function updateEcommerceStoragePriority(storageId: number, priority: number): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/priority', {
    method: 'POST',
    query: { priority, storageId },
  })

  return normalizeCollection<OnlineShopStorage>(result)
}

function normalizeSeoSettings(result: unknown): SeoLocaleEntry[] {
  const settingsByLocale = toSettingsByLocale(result)

  return Object.entries(settingsByLocale)
    .sort(([firstLocale], [secondLocale]) => compareLocales(firstLocale, secondLocale))
    .map(([locale, settings]) => ({
      locale,
      settings: normalizeLocaleSettings(settings),
    }))
}

function normalizeCollection<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object' && 'Collection' in result) {
    const collection = (result as { Collection?: unknown }).Collection

    return Array.isArray(collection) ? (collection as T[]) : []
  }

  return []
}

function toSettingsByLocale(result: unknown): SeoSettingsByLocale {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {}
  }

  const settingsByLocale: SeoSettingsByLocale = {}

  Object.entries(result).forEach(([locale, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      settingsByLocale[locale] = value as SeoLocaleSettings
    }
  })

  return settingsByLocale
}

function normalizeLocaleSettings(settings: SeoLocaleSettings): SeoLocaleSettings {
  return {
    EcommerceContactInfo: settings.EcommerceContactInfo || null,
    EcommerceContactsList: Array.isArray(settings.EcommerceContactsList) ? settings.EcommerceContactsList : [],
    EcommercePages: Array.isArray(settings.EcommercePages) ? settings.EcommercePages : [],
    RetailPaymentTypeTranslate: settings.RetailPaymentTypeTranslate || null,
  }
}

function compareLocales(firstLocale: string, secondLocale: string) {
  const order = ['uk', 'ru']
  const firstIndex = order.indexOf(firstLocale)
  const secondIndex = order.indexOf(secondLocale)

  if (firstIndex !== -1 || secondIndex !== -1) {
    return (firstIndex === -1 ? order.length : firstIndex) - (secondIndex === -1 ? order.length : secondIndex)
  }

  return firstLocale.localeCompare(secondLocale)
}
