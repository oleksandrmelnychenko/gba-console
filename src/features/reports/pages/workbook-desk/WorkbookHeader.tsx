import { Loader, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { DeskSummary } from '../../data/workbookDesk'

type Props = {
  title: string
  fileName: string | null
  templateName: string
  summary: DeskSummary
  resolving: boolean
  warning: string | null
  about: string | null
}

export function WorkbookHeader({ title, fileName, templateName, summary, resolving, warning, about }: Props) {
  const { t } = useI18n()
  const filters = summary.chips.filter(chip => chip.kind === 'filter')
  const views = summary.chips.filter(chip => chip.kind === 'view')
  return <section className="workbook-header" aria-labelledby="workbook-header-title">
    <div className="workbook-header__heading">
      <h2 id="workbook-header-title" className="app-section-title workbook-header__title">{t(title)}</h2>
    </div>
    {templateName.trim() ? <Text className="workbook-header__template">
      {t('Шаблон «{name}»', { name: templateName.trim() })}
    </Text> : null}
    {resolving ? <span className="workbook-header__resolving" role="status">
      <Loader size={14} />{t('Застосовуються відбори книги…')}
    </span> : null}
    {warning ? <p className="workbook-header__warning" role="status">
      <CircleAlert size={16} aria-hidden="true" /><span>{warning}</span>
    </p> : null}
    <details className="workbook-header__about">
      <summary>{t('Про звіт')}</summary>
      <div className="workbook-header__details">
    {fileName ? <Text size="sm">{fileName}</Text> : null}
    {about ? <Text size="sm">{about}</Text> : null}
    <dl className="workbook-header__facts">
      <div className="workbook-header__fact"><dt>{t('Період')}</dt><dd>{summary.period}</dd></div>
      {summary.organizations ? <div className="workbook-header__fact"><dt>{t('Організації')}</dt><dd>{summary.organizations}</dd></div> : null}
    </dl>
    <div className="workbook-header__filters">
      <span className="workbook-header__filters-label">{t('Відбори')}</span>
      {filters.length ? <ul className="workbook-chips" aria-label={t('Застосовані відбори')}>
        {filters.map((chip, index) => <li key={`${index}:${chip.label}`} className="workbook-chip" title={chip.title}>{chip.label}</li>)}
      </ul> : <span className="workbook-header__none">{t('немає')}</span>}
    </div>
    {views.length ? <ul className="workbook-chips workbook-chips--view" aria-label={t('Вигляд звіту')}>
      {views.map((chip, index) => <li key={`${index}:${chip.label}`} className="workbook-chip is-view" title={chip.title}>{chip.label}</li>)}
    </ul> : null}
      </div>
    </details>
  </section>
}
