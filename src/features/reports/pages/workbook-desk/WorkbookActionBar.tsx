import { Button, Loader } from '@mantine/core'
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, MonitorPlay, RotateCcw } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../../shared/url/getDocumentHref'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { PdfIcon } from '../../../../shared/ui/PdfIcon'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { deskDownloadName } from '../../data/workbookDesk'

export const BLOCKED_REASON_ID = 'report-constructor-blocked-reason'

type FileFormat = 'excel' | 'pdf'

type Props = {
  period?: ReactNode
  pending?: boolean
  onCancel?: () => void
  onSaveTemplate?: () => void
  applyLabel?: string
  canSubmit: boolean
  canExport?: boolean
  isLoading: boolean
  blockedReason: string | null
  ran: boolean
  previewNeedsExport?: boolean
  excelUrl: string | null
  pdfUrl: string | null
  fileBaseName: string | null
  resetDisabled: boolean
  onPreview: () => void
  onGenerate: () => void
  onReset: () => void
}

export function WorkbookActionBar({ period, canSubmit, isLoading, blockedReason, ran, previewNeedsExport = false, excelUrl, pdfUrl, fileBaseName, resetDisabled,
  onPreview, onGenerate, onReset, pending = false, canExport = canSubmit, onCancel, onSaveTemplate, applyLabel }: Props) {
  const { t } = useI18n()
  const blocked = !canSubmit && !isLoading && blockedReason ? blockedReason : null
  const describedBy = blocked ? BLOCKED_REASON_ID : undefined
  const missingFile = Boolean(excelUrl) !== Boolean(pdfUrl)
  const file = (format: FileFormat, url: string | null) => {
    const label = format === 'excel' ? 'Excel' : 'PDF'
    const icon = format === 'excel' ? <ExcelIcon size={16} /> : <PdfIcon size={18} />
    if (url) return <Button component="a" variant="default" className="workbook-actions__file is-ready" leftSection={icon}
      href={getDocumentHref(url)} target="_blank" rel="noreferrer"
      download={deskDownloadName(fileBaseName, url, format)}
      aria-label={t('Завантажити {format}', { format: label })}>{label}</Button>
    const missing = ran && !isLoading && !previewNeedsExport
    return <Button type="button" variant="default" className="workbook-actions__file"
      leftSection={icon} disabled={!canExport || isLoading || missing} aria-describedby={describedBy}
      title={missing ? t('Сервер не повернув файл {format} для цього звіту.', { format: label }) : undefined}
      aria-label={t('Сформувати {format}', { format: label })}
      onClick={onGenerate}>{label}</Button>
  }
  return <div className="workbook-actions" role="region" aria-label={t('Дії зі звітом')}>
    <div className="workbook-actions__scroll">
    <div className="app-filter-bar workbook-toolbar">
      {period}
    <div className="app-filter-actions workbook-actions__buttons">
      <Button type="button"
        disabled={resetDisabled} aria-label={t('Скинути')}
        title={t('Повернути період і відбори за замовчуванням')} onClick={onReset} className="reports-toolbar-action" variant="default" leftSection={<RotateCcw size={16} aria-hidden="true" />}>{t('Скинути')}</Button>
      {onCancel ? <Button type="button" variant="default" disabled={!pending || isLoading} onClick={onCancel}>{t('Скасувати зміни')}</Button> : null}
      {onSaveTemplate ? <Button type="button" variant="default" disabled={isLoading} onClick={onSaveTemplate}>{t('Зберегти набір як шаблон')}</Button> : null}
      {file('excel', excelUrl)}
      {file('pdf', pdfUrl)}
      <Button type="button" color={CREATE_ACTION_COLOR} className="workbook-actions__preview"
        leftSection={<MonitorPlay size={16} aria-hidden="true" />} disabled={!canSubmit || isLoading}
        aria-describedby={describedBy} onClick={onPreview}>{t(applyLabel ?? 'Показати на екрані')}</Button>
    </div>
    </div>
    </div>
    <div className="workbook-actions__status" aria-live="polite">
      {isLoading ? <span className="workbook-actions__note is-busy"><Loader size={14} />{t('Звіт формується…')}</span>
        : blocked ? <span id={BLOCKED_REASON_ID} className="workbook-actions__note is-blocked">
          <CircleAlert size={16} aria-hidden="true" /><span>{blocked}</span></span>
        : missingFile ? <span className="workbook-actions__note is-ready">
          <CircleCheck size={16} aria-hidden="true" /><span>{t('Готовий лише файл {ready}: сервер не повернув {missing}.', { ready: excelUrl ? 'Excel' : 'PDF', missing: excelUrl ? 'PDF' : 'Excel' })}</span></span>
        : null}
    </div>
  </div>
}
