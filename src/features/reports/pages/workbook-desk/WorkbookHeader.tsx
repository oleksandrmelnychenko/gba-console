import { Loader, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'

type Props = {
  title: string
  showTitle?: boolean
  templateName: string
  resolving: boolean
  warning: string | null
}

export function WorkbookHeader({ title, showTitle = true, templateName, resolving, warning }: Props) {
  const { t } = useI18n()
  if (!showTitle && !templateName.trim() && !resolving && !warning) return null
  return <section className="workbook-header" aria-label={t(title)}>
    {showTitle ? <div className="workbook-header__heading">
      <h2 id="workbook-header-title" className="app-section-title workbook-header__title">{t(title)}</h2>
    </div> : null}
    {templateName.trim() ? <Text className="workbook-header__template">
      {t('Шаблон «{name}»', { name: templateName.trim() })}
    </Text> : null}
    {resolving ? <span className="workbook-header__resolving" role="status">
      <Loader size={14} />{t('Застосовуються відбори книги…')}
    </span> : null}
    {warning ? <p className="workbook-header__warning" role="status">
      <CircleAlert size={16} aria-hidden="true" /><span>{warning}</span>
    </p> : null}

  </section>
}
