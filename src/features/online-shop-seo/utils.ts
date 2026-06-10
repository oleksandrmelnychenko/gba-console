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

  if (!values.Email.trim()) {
    return translate('Вкажіть e-mail контакту')
  }

  return null
}

export function hasPaymentRecord(payment?: SeoRetailPaymentInfo | null) {
  return Boolean(payment?.NetUid)
}
