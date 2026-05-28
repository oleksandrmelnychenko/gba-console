import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { I18nContext } from './I18nContext'
import {
  getStoredLanguage,
  saveLanguage,
  setDocumentLanguage,
  translate,
} from './translate'
import type { I18nContextValue, LanguageCode, TranslationKey, TranslationParams } from './types'

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage)

  useEffect(() => {
    setDocumentLanguage(language)
    saveLanguage(language)
  }, [language])

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(key, params, language),
    [language],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
