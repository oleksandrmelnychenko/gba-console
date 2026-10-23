import { Loader, Text } from '@mantine/core'
import { Building2, CalendarDays, CircleAlert, FileSpreadsheet, Filter, Info, SlidersHorizontal } from 'lucide-react'
import { TableChip } from '../../../../shared/ui/TableChip'
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
        <dl className="workbook-header__facts">
          <div className="workbook-header__fact">
            <dt><CalendarDays size={14} aria-hidden="true" />{t('Період')}</dt>
            <dd className="workbook-header__period">{summary.period}</dd>
          </div>
          {fileName ? <div className="workbook-header__fact">
            <dt><FileSpreadsheet size={14} aria-hidden="true" />{t('Файл')}</dt>
            <dd><TableChip value={fileName} /></dd>
          </div> : null}
          {summary.organizations ? <div className="workbook-header__fact workbook-header__fact--wide">
            <dt><Building2 size={14} aria-hidden="true" />{t('Організації')}</dt>
            <dd className="workbook-header__organizations"><TableChip tone="product" value={summary.organizations} /></dd>
          </div> : null}
          <div className="workbook-header__fact workbook-header__fact--wide">
            <dt><Filter size={14} aria-hidden="true" />{t('Відбори')}</dt>
            <dd>{filters.length ? <ul className="workbook-chips" aria-label={t('Застосовані відбори')}>
              {filters.map((chip, index) => <li key={`${index}:${chip.label}`}><TableChip tone="document" value={chip.label} title={chip.title} /></li>)}
            </ul> : <span className="workbook-header__none">{t('немає')}</span>}</dd>
          </div>
          {views.length ? <div className="workbook-header__fact workbook-header__fact--wide">
            <dt><SlidersHorizontal size={14} aria-hidden="true" />{t('Вигляд')}</dt>
            <dd><ul className="workbook-chips" aria-label={t('Вигляд звіту')}>
              {views.map((chip, index) => <li key={`${index}:${chip.label}`}><TableChip value={chip.label} title={chip.title} /></li>)}
            </ul></dd>
          </div> : null}
        </dl>
        {about ? <details className="workbook-header__description">
          <summary><Info size={14} aria-hidden="true" />{t('Особливості звіту')}</summary>
          <Text size="sm">{about}</Text>
        </details> : null}
      </div>
    </details>
  </section>
}
