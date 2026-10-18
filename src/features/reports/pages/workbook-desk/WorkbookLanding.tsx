import { Alert, Button, Loader, Text } from '@mantine/core'
import { ArrowLeftRight, ArrowRight, CalendarDays, ChartNoAxesCombined, CircleAlert, PackageSearch, ReceiptText, Truck, WalletCards, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { deskPeriodText, workbookDefaultPeriod, workbookDeskEntry } from '../../data/workbookDesk'

const REPORT_ICONS: Record<number, LucideIcon> = {
  35: ChartNoAxesCombined, 38: Truck, 39: PackageSearch, 40: WalletCards, 41: ArrowLeftRight,
}

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
      <h2 id="workbook-landing-title" className="app-section-title workbook-landing__title">{t('Звіти')}</h2>
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
    </div> : launches.length === 0 ? <Alert color="gray" icon={<CircleAlert size={18} />} title={t('Звіти зараз недоступні')}>
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
  const Icon = launch.fileName === 'ДБіторка.xls' ? ReceiptText : REPORT_ICONS[launch.dataset.DataSource] ?? ChartNoAxesCombined
  return <article className="workbook-card" aria-labelledby={titleId}>
    <div className="workbook-card__body">
      <div className="workbook-card__top">
        <span className="workbook-card__icon"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
        <h3 id={titleId} className="workbook-card__title">{t(name)}</h3>
      </div>
      <Text className="workbook-card__description">{t(entry?.description ?? launch.notice)}</Text>
    </div>
    <div className="workbook-card__foot">
      {period ? <div className="workbook-card__period">
        <CalendarDays size={15} aria-hidden="true" />
        <span className="workbook-card__dates">{deskPeriodText(period.from, period.to)}</span>
      </div> : null}
      <Button type="button" variant="default" className="workbook-card__open" disabled={disabled}
        rightSection={<ArrowRight size={15} aria-hidden="true" />}
        aria-label={t('Відкрити {file}', { file: launch.fileName })} onClick={() => onOpen(launch)}>{t('Відкрити')}</Button>
    </div>
  </article>
}
