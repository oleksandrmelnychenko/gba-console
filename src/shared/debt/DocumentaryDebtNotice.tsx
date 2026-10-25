import { useI18n } from '../i18n/useI18n'
import { documentaryBusinessDate, type documentaryAgreementPresentation } from './documentaryDebtAging'

export function DocumentaryDebtNotice({ presentation, asOf }: {
  presentation: ReturnType<typeof documentaryAgreementPresentation>
  asOf?: string
}) {
  const { t } = useI18n()
  if (!presentation.present) return null
  const day = documentaryBusinessDate(asOf)
  const summary = presentation.summary
  return (
    <span className="app-muted" role="note">
      {!summary ? t('Дані про строки боргу не визначено') : !presentation.complete ? (
        <>
          {t('Прострочення визначено частково')}
          {summary.UnknownDateDebtCount > 0 && ` · ${t('Без підтвердженої дати')}: ${summary.UnknownDateDebtCount}`}
          {summary.UnknownTermsDebtCount > 0 && ` · ${t('Без строку оплати')}: ${summary.UnknownTermsDebtCount}`}
          {summary.UnknownScopeDebtCount > 0 && ` · ${t('Без підтвердженої належності')}: ${summary.UnknownScopeDebtCount}`}
        </>
      ) : t('Строки боргу підтверджено')}
      {day ? ` · ${t('Станом на')} ${day}` : ''}
    </span>
  )
}
