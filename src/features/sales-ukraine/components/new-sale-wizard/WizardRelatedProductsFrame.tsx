import { useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'

/** Keep the last complete panel visible while the next selection is loading. */
export function WizardRelatedProductsFrame({
  children,
  loading,
  scopeKey,
}: {
  children: ReactNode
  loading: boolean
  scopeKey: string
}) {
  const { t } = useI18n()
  const [settled, setSettled] = useState<{ content: ReactNode; scopeKey: string } | null>(null)
  // Capture complete props before painting. Loading props must never replace
  // this snapshot with skeletons or callbacks belonging to a different scope.
  if (!loading && (settled?.content !== children || settled?.scopeKey !== scopeKey)) {
    setSettled({ content: children, scopeKey })
  }
  const retained = loading && settled?.scopeKey === scopeKey

  return (
    <div aria-busy={loading} className="new-sale-products-step__related-grid">
      <div
        aria-hidden={loading || undefined}
        className="wizard-related-frame__content"
        inert={loading}
      >
        {retained ? settled.content : children}
      </div>
      {loading && (
        <div className="wizard-related-frame__loading" role="status">
          {t('Завантаження товарів')}
        </div>
      )}
    </div>
  )
}
