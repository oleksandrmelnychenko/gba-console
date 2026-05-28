import { ukMessages } from './messages/uk'
import type {
  LanguageCode,
  TranslationKey,
  TranslationMessages,
  TranslationParams,
} from './types'

const messagesByLanguage: Record<LanguageCode, TranslationMessages> = {
  uk: ukMessages,
}

const defaultLanguage: LanguageCode = 'uk'
const languageStorageKey = 'gba.console.language'
const supportedLanguages = new Set<LanguageCode>(['uk'])

export function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return defaultLanguage
  }

  const savedLanguage = window.localStorage.getItem(languageStorageKey) as LanguageCode | null

  return savedLanguage && supportedLanguages.has(savedLanguage) ? savedLanguage : defaultLanguage
}

export function saveLanguage(language: LanguageCode) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(languageStorageKey, language)
}

export function setDocumentLanguage(language: LanguageCode) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = language
}

export function translate(
  key: TranslationKey,
  params?: TranslationParams,
  language: LanguageCode = getStoredLanguage(),
): string {
  return formatTranslation(messagesByLanguage[language][key] ?? key, params)
}

function formatTranslation(message: string, params?: TranslationParams): string {
  if (!params) {
    return message
  }

  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, value == null ? '' : String(value))
  }, message)
}
