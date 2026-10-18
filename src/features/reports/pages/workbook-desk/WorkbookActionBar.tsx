import { Button, Loader } from '@mantine/core'
import { CircleAlert, CircleCheck, FileText, MonitorPlay, RotateCcw } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../../shared/url/getDocumentHref'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { deskDownloadName } from '../../data/workbookDesk'

export const BLOCKED_REASON_ID = 'report-constructor-blocked-reason'

type FileFormat = 'excel' | 'pdf'

type Props = {
  canSubmit: boolean
  isLoading: boolean
  blockedReason: string | null
  ran: boolean
  excelUrl: string | null
  pdfUrl: string | null
  fileBaseName: string | null
  resetDisabled: boolean
  onPreview: () => void
  onGenerate: () => void
  onReset: () => void
}

export function WorkbookActionBar({ canSubmit, isLoading, blockedReason, ran, excelUrl, pdfUrl, fileBaseName, resetDisabled,
  onPreview, onGenerate, onReset }: Props) {
  const { t } = useI18n()
  const blocked = !canSubmit && !isLoading && blockedReason ? blockedReason : null
  const describedBy = blocked ? BLOCKED_REASON_ID : undefined
  const ready = Boolean(excelUrl || pdfUrl)
  const file = (format: FileFormat, url: string | null) => {
    const label = format === 'excel' ? 'Excel' : 'PDF'
    const icon = format === 'excel' ? <ExcelIcon size={16} /> : <FileText size={16} aria-hidden="true" />
    if (url) return <Button component="a" variant="default" className="workbook-actions__file is-ready" leftSection={icon}
      href={getDocumentHref(url)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, url, format)}
      aria-label={t('Завантажити {format}', { format: label })}>{label}</Button>
    const missing = ran && !isLoading
    return <Button type={format === 'excel' ? 'submit' : 'button'} variant="default" className="workbook-actions__file"
      leftSection={icon} disabled={!canSubmit || isLoading || missing} aria-describedby={describedBy}
      title={missing ? t('Сервер не повернув файл {format} для цього звіту.', { format: label }) : undefined}
      aria-label={t('Сформувати {format}', { format: label })}
      onClick={format === 'pdf' ? onGenerate : undefined}>{label}</Button>
  }
  return <div className="workbook-actions" role="region" aria-label={t('Дії зі звітом')}>
    <div className="workbook-actions__buttons">
      <Button type="button" color={CREATE_ACTION_COLOR} className="workbook-actions__preview"
        leftSection={<MonitorPlay size={16} aria-hidden="true" />} disabled={!canSubmit || isLoading}
        aria-describedby={describedBy} onClick={onPreview}>{t('Показати на екрані')}</Button>
      {file('excel', excelUrl)}
      {file('pdf', pdfUrl)}
      <span className="workbook-actions__divider" aria-hidden="true" />
      <Button type="button" variant="subtle" color="gray" className="workbook-actions__reset"
        leftSection={<RotateCcw size={15} aria-hidden="true" />} disabled={resetDisabled}
        title={t('Повернути період і відбори за замовчуванням')} onClick={onReset}>{t('Скинути')}</Button>
    </div>
    <div className="workbook-actions__status" aria-live="polite">
      {isLoading ? <span className="workbook-actions__note is-busy"><Loader size={14} />{t('Звіт формується…')}</span>
        : blocked ? <span id={BLOCKED_REASON_ID} className="workbook-actions__note is-blocked">
          <CircleAlert size={16} aria-hidden="true" /><span>{blocked}</span></span>
        : ready ? <span className="workbook-actions__note is-ready">
          <CircleCheck size={16} aria-hidden="true" /><span>{excelUrl && pdfUrl
            ? t('Файли готові — натисніть «Excel» або «PDF», щоб завантажити.')
            : t('Готовий лише файл {ready}: сервер не повернув {missing}.', { ready: excelUrl ? 'Excel' : 'PDF', missing: excelUrl ? 'PDF' : 'Excel' })}</span></span>
        : null}
    </div>
  </div>
}
