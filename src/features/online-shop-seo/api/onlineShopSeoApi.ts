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

export async function updateSeoPage(page: SeoPage, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/page/update/locale', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: page,
  })

  return normalizeSeoSettings(result)
}

export async function updateSeoContactInfo(contactInfo: SeoContactInfo, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contactinfo/update', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: contactInfo,
  })

  return normalizeSeoSettings(result)
}

export async function updateSeoPaymentInfo(paymentInfo: SeoRetailPaymentInfo, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/retail/payment/update', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: paymentInfo,
  })

  return normalizeSeoSettings(result)
}

export async function createSeoContact(contact: SeoContact, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/add', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: contact,
  })

  return normalizeSeoSettings(result)
}

export async function uploadSeoContactImage(file: File, mode: 'create' | 'edit', signal?: AbortSignal): Promise<string> {
  const formData = new FormData()
  formData.append('img', file)

  const result = await apiRequest<unknown>(`/seo/info/contacts/${mode}/img/add`, {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: formData,
  })

  return typeof result === 'string' ? result : ''
}

export async function updateSeoContact(contact: SeoContact, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/update', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    body: contact,
  })

  return normalizeSeoSettings(result)
}

export async function removeSeoContact(netId: string, signal?: AbortSignal): Promise<SeoLocaleEntry[]> {
  const result = await apiRequest<unknown>('/seo/info/contacts/remove', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    query: { netId },
  })

  return normalizeSeoSettings(result)
}

export async function getOnlineShopClients(): Promise<OnlineShopClient[]> {
  const result = await apiRequest<unknown>('/clients/online-shop-seo/all/shop')

  return normalizeCollection<OnlineShopClient>(result)
}

export async function toggleOnlineShopClient(netId: string): Promise<OnlineShopClient[]> {
  const result = await apiRequest<unknown>('/clients/online-shop-seo/retail/set', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopClient>(result)
}

export async function getOnlineShopPaymentRegisters(): Promise<OnlineShopPaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/online-shop-seo/all/retail')

  return normalizeCollection<OnlineShopPaymentRegister>(result)
}

export async function selectOnlineShopPaymentRegister(netId: string): Promise<OnlineShopPaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/online-shop-seo/select', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopPaymentRegister>(result)
}

export async function getEcommerceStorages(): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/online-shop-seo/all/ecommerce')

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function getAllOnlineShopStorages(): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/online-shop-seo/all')

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function addEcommerceStorage(netId: string): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/online-shop-seo/ecommerce/set', {
    method: 'POST',
    query: { netId },
  })

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function removeEcommerceStorage(netId: string, signal?: AbortSignal): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/online-shop-seo/ecommerce/unselect', {
    method: 'POST',
    ...(signal ? { signal } : {}),
    query: { netId },
  })

  return normalizeCollection<OnlineShopStorage>(result)
}

export async function updateEcommerceStoragePriority(storageId: number, priority: number, signal?: AbortSignal): Promise<OnlineShopStorage[]> {
  const result = await apiRequest<unknown>('/storages/online-shop-seo/priority', {
    method: 'POST',
    ...(signal ? { signal } : {}),
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
