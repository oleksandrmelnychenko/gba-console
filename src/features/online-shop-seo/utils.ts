import type {
  SeoContact,
  SeoContactFormValues,
  SeoContactInfo,
  SeoContactInfoFormValues,
  SeoLocaleEntry,
  SeoPage,
  SeoPageFormValues,
  SeoPageRow,
  SeoPaymentFormValues,
  SeoRetailPaymentInfo,
} from './types'
import { translate } from '../../shared/i18n/translate'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function displayValue(value: unknown, fallback = '-') {
  if (typeof value === 'string') {
    return value.trim() || fallback
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

export function formatDateTime(value?: Date | string) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateTimeFormatter.format(date)
}

export function getLocaleLabel(locale: string) {
  return locale.toUpperCase()
}

export function getPageTitle(page: SeoPage) {
  return page.PageName || page.Title || page.Url || page.NetUid || 'SEO page'
}

export function getAllPageRows(entries: SeoLocaleEntry[]): SeoPageRow[] {
  return entries.flatMap((entry) =>
    (entry.settings.EcommercePages || []).map((page) => ({
      locale: page.Locale || entry.locale,
      page,
    })),
  )
}

export function getUniqueContacts(entries: SeoLocaleEntry[]) {
  const contacts = entries.flatMap((entry) => entry.settings.EcommerceContactsList || [])
  const seenContactIds = new Set<string>()

  return contacts.filter((contact, index) => {
    const contactId = contact.NetUid || String(contact.Id || index)

    if (seenContactIds.has(contactId)) {
      return false
    }

    seenContactIds.add(contactId)
    return true
  })
}

export function pageToFormValues(page?: SeoPage | null): SeoPageFormValues {
  return {
    Description: page?.Description || '',
    KeyWords: page?.KeyWords || '',
    LdJson: page?.LdJson || '',
    PageName: page?.PageName || '',
    Title: page?.Title || '',
    Url: page?.Url || '',
  }
}

export function contactInfoToFormValues(contactInfo?: SeoContactInfo | null): SeoContactInfoFormValues {
  return {
    Address: contactInfo?.Address || '',
    Email: contactInfo?.Email || '',
    Phone: contactInfo?.Phone || '',
    PixelId: contactInfo?.PixelId || '',
    SiteUrl: contactInfo?.SiteUrl || '',
  }
}

export function paymentToFormValues(payment?: SeoRetailPaymentInfo | null): SeoPaymentFormValues {
  return {
    Comment: payment?.Comment || '',
    FastOrderSuccessMessage: payment?.FastOrderSuccessMessage || '',
    FullPrice: payment?.FullPrice || '',
    LowPrice: payment?.LowPrice || '',
    ScreenshotMessage: payment?.ScreenshotMessage || '',
  }
}

export function contactToFormValues(contact?: SeoContact | null): SeoContactFormValues {
  return {
    Email: contact?.Email || '',
    FirstName: contact?.FirstName || '',
    ImgUrl: contact?.ImgUrl || '',
    LastName: contact?.LastName || '',
    MiddleName: contact?.MiddleName || '',
    Phone: contact?.Phone || '',
  }
}

export function getSeoContactDisplayName(contact?: Partial<SeoContactFormValues | SeoContact> | null) {
  const legacyName = typeof (contact as { Name?: unknown } | null)?.Name === 'string'
    ? ((contact as { Name?: string }).Name || '').trim()
    : ''
  const fullName = [contact?.LastName, contact?.FirstName, contact?.MiddleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  return fullName || legacyName
}

export function validatePage(values: SeoPageFormValues) {
  if (!values.PageName.trim()) {
    return translate('Вкажіть назву сторінки')
  }

  return null
}

export function validateContact(values: SeoContactFormValues) {
  if (!getSeoContactDisplayName(values)) {
    return translate('Вкажіть ПІБ контакту')
  }

  if (!values.Phone.trim()) {
    return translate('Вкажіть телефон контакту')
  }

  const phoneError = validateSeoPhone(values.Phone)

  if (phoneError) {
    return phoneError
  }

  if (!values.Email.trim()) {
    return translate('Вкажіть e-mail контакту')
  }

  return validateSeoEmail(values.Email)
}

/** Column sizes of EcommerceContactInfo, RetailPaymentTypeTranslate and EcommercePage (gba-server table maps). */
export const SEO_FIELD_MAX_LENGTH = {
  Address: 250,
  Comment: 500,
  ContactInfoEmail: 150,
  ContactInfoPhone: 30,
  FastOrderSuccessMessage: 500,
  FullPrice: 250,
  LowPrice: 250,
  PageDescription: 1000,
  PageKeyWords: 1000,
  PageLdJson: 4000,
  PageTitle: 100,
  PageUrl: 1000,
  PixelId: 200,
  SiteUrl: 200,
} as const

const SEO_PHONE_PATTERN = /^\+?[\d\s()-]+$/
const SEO_EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

/** Empty is allowed; otherwise digits with optional +, spaces, brackets and dashes (9-15 digits). */
export function validateSeoPhone(value: string): string | null {
  const phone = value.trim()

  if (!phone) {
    return null
  }

  const digits = phone.replace(/\D/g, '').length

  if (!SEO_PHONE_PATTERN.test(phone) || digits < 9 || digits > 15) {
    return translate('Телефон має містити 9–15 цифр; дозволено також +, пробіли, дужки та дефіси')
  }

  return null
}

export function validateSeoEmail(value: string): string | null {
  const email = value.trim()

  if (!email) {
    return null
  }

  return SEO_EMAIL_PATTERN.test(email) ? null : translate('Вкажіть коректний e-mail')
}

/** Only absolute http(s) links: a javascript: or data: URL must never reach the storefront. */
export function validateSeoSiteUrl(value: string): string | null {
  const siteUrl = value.trim()

  if (!siteUrl) {
    return null
  }

  try {
    const url = new URL(siteUrl)

    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) {
      return null
    }
  } catch {
    // falls through to the error below
  }

  return translate('Site URL має починатися з http:// або https://')
}

export type SeoContactInfoFieldErrors = Partial<Record<keyof SeoContactInfoFormValues, string>>

export function getContactInfoFieldErrors(values: SeoContactInfoFormValues): SeoContactInfoFieldErrors {
  const errors: SeoContactInfoFieldErrors = {}
  const phoneError = validateSeoPhone(values.Phone)
  const emailError = validateSeoEmail(values.Email)
  const siteUrlError = validateSeoSiteUrl(values.SiteUrl)

  if (phoneError) errors.Phone = phoneError
  if (emailError) errors.Email = emailError
  if (siteUrlError) errors.SiteUrl = siteUrlError

  return errors
}

export const MAX_SQL_INT = 2147483647

/** Integer priority within the SQL int range (the server silently stored 0 for 99999999999). */
export function validatePriorityRange(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return translate('Вкажіть пріоритет')
  }

  const priority = Number(trimmedValue)

  if (!/^\d+$/.test(trimmedValue) || !Number.isInteger(priority) || priority < 1) {
    return translate('Пріоритет має бути цілим додатним числом')
  }

  if (priority > MAX_SQL_INT) {
    return translate('Пріоритет не може перевищувати {max}', { max: MAX_SQL_INT })
  }

  return null
}

export const SEO_CONTACT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

const SEO_CONTACT_IMAGE_TYPES = new Set(SEO_CONTACT_IMAGE_ACCEPT.split(','))

function hasImageSignature(bytes: Uint8Array): boolean {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte)

  return (
    startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || // PNG
    startsWith([0xff, 0xd8, 0xff]) || // JPEG
    startsWith([0x47, 0x49, 0x46, 0x38]) || // GIF
    (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) // WEBP
  )
}

async function readFileHead(file: Blob, length: number): Promise<Uint8Array> {
  const head = file.slice(0, length)

  if (typeof head.arrayBuffer === 'function') {
    return new Uint8Array(await head.arrayBuffer())
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(head)
  })
}

/** A real PNG/JPEG/GIF/WEBP: both the declared MIME type and the file signature must match (a renamed text file is rejected). */
export async function validateSeoContactImage(file: File): Promise<string | null> {
  const message = translate('Оберіть зображення PNG, JPEG, GIF або WEBP')

  if (!SEO_CONTACT_IMAGE_TYPES.has(file.type)) {
    return message
  }

  try {
    return hasImageSignature(await readFileHead(file, 12)) ? null : message
  } catch {
    return message
  }
}

export function hasPaymentRecord(payment?: SeoRetailPaymentInfo | null) {
  return Boolean(payment?.NetUid)
}

/**
 * Contact photos live under /Data/Seo on the API, served through the console's own origin. Rows saved before
 * the server stored relative paths carry the address of whichever console uploaded them
 * (http://127.0.0.7:5176/Data/Seo/…); show those through this origin too.
 */
export function resolveSeoContactImageUrl(url?: string | null): string | undefined {
  const value = url?.trim()

  if (!value) {
    return undefined
  }

  try {
    const parsed = new URL(value, window.location.origin)

    if (parsed.pathname.startsWith('/Data/Seo/')) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    // Not a URL: use it as it is.
  }

  return value
}
