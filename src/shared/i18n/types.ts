import type { ukMessages } from './messages/uk'

export type LanguageCode = 'uk'
export type TranslationKey = keyof typeof ukMessages | (string & {})
export type TranslationParams = Record<string, number | string | null | undefined>
export type TranslationMessages = Partial<Record<TranslationKey, string>>
export type TranslateFunction = (key: TranslationKey, params?: TranslationParams) => string

export type I18nContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: TranslateFunction
}
