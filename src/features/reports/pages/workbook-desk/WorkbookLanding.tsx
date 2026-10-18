import { Alert, Badge, Button, Loader, Text } from '@mantine/core'
import { IconFileSpreadsheet } from '@tabler/icons-react'
import { ArrowRight, CalendarDays, CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { deskPeriodKind, deskPeriodText, workbookDefaultPeriod, workbookDeskEntry } from '../../data/workbookDesk'

type Props = {
  launches: readonly WorkbookLaunch[]
  today: string
  disabled: boolean
  loading: boolean
  error: string | null
  canGenerate: boolean
  openReport: string | null
  actions: ReactNode
  more: ReactNode
  onOpen: (launch: WorkbookLaunch) => void
  onReturn: () => void
  onRetry: () => void
}

export function WorkbookLanding({ launches, today, disabled, loading, error, canGenerate, openReport, actions, more,
  onOpen, onReturn, onRetry }: Props) {
  const { t } = useI18n()
  return <section className="workbook-landing" aria-labelledby="workbook-landing-title">
    <div className="workbook-landing__head">
      <div className="workbook-landing__heading">
        <span className="workbook-landing__icon" aria-hidden="true"><IconFileSpreadsheet size={24} /></span>
        <div>
          <h2 id="workbook-landing-title" className="workbook-landing__title">{t('Звіти 1С')}</h2>
          <Text className="workbook-landing__lead">
            {t('Оберіть звіт, перевірте період і відбори, перегляньте таблицю на екрані або завантажте Excel чи PDF.')}
          </Text>
        </div>
      </div>
      <div className="workbook-landing__actions">{actions}</div>
    </div>
    {openReport ? <button type="button" className="workbook-landing__return" onClick={onReturn}>
      {t('Повернутися до звіту «{name}»', { name: openReport })}<ArrowRight size={15} aria-hidden="true" />
    </button> : null}
    {!canGenerate ? <Alert color="yellow" icon={<CircleAlert size={18} />} title={t('Немає доступу до звітів')}>
      {t('Ваша роль не дозволяє формувати звіти. Зверніться до адміністратора.')}
    </Alert> : error ? <Alert color="red" icon={<CircleAlert size={18} />} title={t('Не вдалося завантажити список звітів')}>
      <Text size="sm">{error}</Text>
      <Button size="xs" variant="default" mt="xs" type="button" onClick={onRetry}>{t('Спробувати ще раз')}</Button>
    </Alert> : loading ? <div className="workbook-landing__loading" role="status">
      <Loader size="sm" /><Text size="sm">{t('Завантаження звітів…')}</Text>
    </div> : launches.length === 0 ? <Alert color="gray" icon={<CircleAlert size={18} />} title={t('Звіти 1С зараз недоступні')}>
      {t('Сервер звітів не підтвердив жодної книги. Спробуйте оновити сторінку пізніше.')}
    </Alert> : <div className="workbook-landing__grid">
      {launches.map(launch => <WorkbookCard key={launch.fileName} launch={launch} today={today} disabled={disabled} onOpen={onOpen} />)}
    </div>}
    {canGenerate && !loading && !error ? <details className="workbook-landing__more">
      <summary>{t('Інші способи відкрити звіт')}</summary>
      <div className="workbook-landing__more-body">{more}</div>
    </details> : null}
  </section>
}

function WorkbookCard({ launch, today, disabled, onOpen }: {
  launch: WorkbookLaunch; today: string; disabled: boolean; onOpen: (launch: WorkbookLaunch) => void
}) {
  const { t } = useI18n()
  const entry = workbookDeskEntry(launch.fileName)
  const name = entry?.name ?? launch.label
  const titleId = `workbook-card-${launch.fileName.replace(/[^\p{L}\p{N}]+/gu, '-')}`
  const period = workbookDefaultPeriod(launch.fileName, launch.dataset.DataSource, today)
  const kind = period ? deskPeriodKind(period, today) : null
  return <article className="workbook-card" aria-labelledby={titleId}>
    <div className="workbook-card__top">
      <span className="workbook-card__icon" aria-hidden="true"><IconFileSpreadsheet size={20} /></span>
      <Badge className="app-role-pill is-gray workbook-card__file" variant="light" tt="none">{launch.fileName}</Badge>
    </div>
    <div className="workbook-card__body">
      <h3 id={titleId} className="workbook-card__title">{t(name)}</h3>
      {entry && entry.reportName !== entry.name ? <Text className="workbook-card__report">{t(entry.reportName)}</Text> : null}
      <Text className="workbook-card__description">{t(entry?.description ?? launch.notice)}</Text>
    </div>
    <div className="workbook-card__foot">
      {period ? <div className="workbook-card__period">
        <CalendarDays size={15} aria-hidden="true" />
        <span><span className="workbook-card__period-label">{t('Період за замовчуванням')}: </span>
          {kind ? `${t(kind)} · ` : ''}<span className="workbook-card__dates">{deskPeriodText(period.from, period.to)}</span></span>
      </div> : null}
      <Button type="button" className="workbook-card__open" disabled={disabled}
        aria-label={t('Відкрити {file}', { file: launch.fileName })} onClick={() => onOpen(launch)}>{t('Відкрити')}</Button>
    </div>
  </article>
}
