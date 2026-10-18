import { Loader } from '@mantine/core'
import { CircleAlert, CircleCheck, FileText, Info, MonitorPlay, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../../shared/url/getDocumentHref'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { deskDownloadName, typicalRunSeconds, typicalRunText } from '../../data/workbookDesk'

type Tone = 'idle' | 'info' | 'success' | 'warning' | 'error'

type Props = {
  dataSource: number
  title: string
  period: string
  isLoading: boolean
  error: string | null
  emptyRun: string | null
  stale: boolean
  generated: boolean
  table: ReactNode
  excelUrl: string | null
  pdfUrl: string | null
  fileBaseName: string | null
}

export function WorkbookResult({ dataSource, title, period, isLoading, error, emptyRun, stale, generated, table,
  excelUrl, pdfUrl, fileBaseName }: Props) {
  const { t } = useI18n()
  const section = useRef<HTMLElement>(null)
  const hasTable = Boolean(table)
  useEffect(() => {
    const node = section.current
    if (!hasTable || !node) return
    if (node.getBoundingClientRect().top > window.innerHeight * 0.6) node.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [hasTable])
  const files = table && (excelUrl || pdfUrl) ? <div className="workbook-result__files">
    <span>{t('Усі рядки та підсумки — у файлах:')}</span>
    {excelUrl ? <a className="workbook-result__file" href={getDocumentHref(excelUrl)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, excelUrl, 'excel')}><ExcelIcon size={15} />Excel</a> : null}
    {pdfUrl ? <a className="workbook-result__file" href={getDocumentHref(pdfUrl)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, pdfUrl, 'pdf')}><FileText size={15} aria-hidden="true" />PDF</a> : null}
  </div> : null
  return <section ref={section} className="workbook-result" aria-labelledby="workbook-result-title" aria-busy={isLoading}>
    <div className="workbook-result__head">
      <h2 id="workbook-result-title" className="app-section-title workbook-result__title">{t('Результат')}</h2>
      {files}
    </div>
    {isLoading ? <RunProgress dataSource={dataSource} title={title} period={period} />
      : error ? <ResultMessage tone="error" title={t('Звіт не сформовано')} text={error}
        next={t('Натисніть «Показати на екрані» ще раз. Якщо помилка повторюється, змініть період чи відбори або передайте цей текст адміністратору.')} />
      : emptyRun ? <ResultMessage tone="warning" title={t('Файл звіту не сформовано')} text={emptyRun} />
      : table ? table
      : generated ? <ResultMessage tone="success" title={t('Файли сформовано')}
        text={t('Завантажте Excel або PDF кнопками вгорі. Щоб побачити таблицю тут, натисніть «Показати на екрані».')} />
      : stale ? <ResultMessage tone="info" title={t('Налаштування змінено')}
        text={t('Таблиця вже не відповідає налаштуванням. Натисніть «Показати на екрані», щоб оновити її.')} />
      : <ResultMessage tone="idle" title={t('Таблиці ще немає')}
        text={t('Натисніть «Показати на екрані», щоб побачити таблицю тут, або «Excel» чи «PDF», щоб одразу отримати файл. {typical}', { typical: t(typicalRunText(dataSource)) })} />}
  </section>
}

const TONE_ICONS: Record<Tone, ReactNode> = {
  idle: <MonitorPlay size={20} aria-hidden="true" />,
  info: <Info size={20} aria-hidden="true" />,
  success: <CircleCheck size={20} aria-hidden="true" />,
  warning: <TriangleAlert size={20} aria-hidden="true" />,
  error: <CircleAlert size={20} aria-hidden="true" />,
}

function ResultMessage({ tone, title, text, next }: { tone: Tone; title: string; text: string; next?: string }) {
  return <div className={`workbook-message is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span className="workbook-message__icon">{TONE_ICONS[tone]}</span>
    <div className="workbook-message__body">
      <strong>{title}</strong>
      <p>{text}</p>
      {next ? <p className="workbook-message__next">{next}</p> : null}
    </div>
  </div>
}

const STAGES = [
  'Надсилаємо запит на сервер звітів',
  'Сервер читає документи за період',
  'Рахуємо суми й підсумки',
  'Готуємо таблицю та файли Excel і PDF',
] as const

function RunProgress({ dataSource, title, period }: { dataSource: number; title: string; period: string }) {
  const { t } = useI18n()
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [low, high] = typicalRunSeconds(dataSource)
  const overdue = seconds > high
  const stage = seconds < 2 ? 0 : seconds < high * 0.45 ? 1 : seconds < high * 0.8 ? 2 : 3
  const percent = Math.min(94, Math.round(100 * (1 - Math.exp(-seconds / Math.max(1, high * 0.55)))))
  return <div className="workbook-progress">
    <div className="workbook-progress__head">
      <Loader size={18} />
      <strong>{t('Формуємо «{title}» за {period}', { title: t(title), period })}</strong>
    </div>
    <div className="workbook-progress__bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
    <div className="workbook-progress__meta">
      <span className="workbook-progress__elapsed">{t('{seconds} с', { seconds })}</span>
      <span>{t('зазвичай {low}–{high} с', { low, high })}</span>
    </div>
    <ol className="workbook-progress__stages">
      {STAGES.map((label, index) => <li key={label} className={index < stage ? 'is-done' : index === stage ? 'is-current' : undefined}
        aria-current={index === stage ? 'step' : undefined}>{t(label)}</li>)}
    </ol>
    <p className="workbook-progress__status" role="status">{overdue
      ? t('Довше, ніж зазвичай: сервер ще працює. Зачекайте — сторінку не закривайте.')
      : t('Зараз: {stage}.', { stage: t(STAGES[stage]).toLocaleLowerCase('uk-UA') })}</p>
  </div>
}
