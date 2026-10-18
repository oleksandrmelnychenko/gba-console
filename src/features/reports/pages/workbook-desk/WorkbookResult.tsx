import { Loader } from '@mantine/core'
import { CircleAlert, CircleCheck, Info, MonitorPlay, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../../shared/url/getDocumentHref'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { PdfIcon } from '../../../../shared/ui/PdfIcon'
import { deskDownloadName, typicalRunSeconds } from '../../data/workbookDesk'

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
    {excelUrl ? <a className="workbook-result__file" href={getDocumentHref(excelUrl)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, excelUrl, 'excel')}><ExcelIcon size={15} />Excel</a> : null}
    {pdfUrl ? <a className="workbook-result__file" href={getDocumentHref(pdfUrl)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, pdfUrl, 'pdf')}><PdfIcon size={18} />PDF</a> : null}
  </div> : null
  return <section ref={section} className="workbook-result" aria-labelledby="workbook-result-title" aria-busy={isLoading}>
    <div className="workbook-result__head">
      <h2 id="workbook-result-title" className="app-section-title workbook-result__title">{t('Результат')}</h2>
      {files}
    </div>
    {isLoading ? <RunProgress dataSource={dataSource} title={title} period={period} />
      : error ? <ResultMessage tone="error" title={t('Звіт не сформовано')} text={error} />
      : emptyRun ? <ResultMessage tone="warning" title={t('Файл звіту не сформовано')} text={emptyRun} />
      : table ? table
      : generated ? <ResultMessage tone="success" title={t('Файли сформовано')}
        text={null} />
      : stale ? <ResultMessage tone="info" title={t('Налаштування змінено')}
        text={t('Сформуйте звіт повторно.')} />
      : <ResultMessage tone="idle" title={t('Таблиці ще немає')}
        text={null} />}
  </section>
}

const TONE_ICONS: Record<Tone, ReactNode> = {
  idle: <MonitorPlay size={20} aria-hidden="true" />,
  info: <Info size={20} aria-hidden="true" />,
  success: <CircleCheck size={20} aria-hidden="true" />,
  warning: <TriangleAlert size={20} aria-hidden="true" />,
  error: <CircleAlert size={20} aria-hidden="true" />,
}

function ResultMessage({ tone, title, text }: { tone: Tone; title: string; text: string | null }) {
  return <div className={`workbook-message is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span className="workbook-message__icon">{TONE_ICONS[tone]}</span>
    <div className="workbook-message__body">
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
    </div>
  </div>
}

function RunProgress({ dataSource, title, period }: { dataSource: number; title: string; period: string }) {
  const { t } = useI18n()
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [, high] = typicalRunSeconds(dataSource)
  const overdue = seconds > high
  return <div className="workbook-progress">
    <div className="workbook-progress__head">
      <Loader size={18} />
      <strong>{t('Формуємо «{title}» за {period}', { title: t(title), period })}</strong>
    </div>
    <div className="workbook-progress__bar" role="progressbar" aria-label={t('Формування звіту')}>
      <span aria-hidden="true" />
    </div>
    <span className="workbook-progress__elapsed">{t('{seconds} с', { seconds })}</span>
    {overdue ? <p className="workbook-progress__status" role="status">{t('Формування триває довше, ніж зазвичай…')}</p> : null}
  </div>
}
