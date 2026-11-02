import { useState, type ReactNode } from 'react'
import { ActionIcon, Button, Loader, TextInput } from '@mantine/core'
import { ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, Download, FileChartColumn, Play, RotateCcw, Save, Settings, Undo2 } from 'lucide-react'
import { ToolbarDateRangeFilter } from '../../../../shared/ui/ToolbarDateRangeFilter'
import { getDocumentHref } from '../../../../shared/url/getDocumentHref'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { PdfIcon } from '../../../../shared/ui/PdfIcon'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { deskDownloadName } from '../../data/workbookDesk'
import { BLOCKED_REASON_ID } from '../workbook-desk/WorkbookActionBar'
import './constructor-desk.css'

export type ConstructorDeskPeriod = {
  from: string
  to: string
  minDate: string
  maxDate: string
  error: string | null
  disabled: boolean
  onChange: (range: { from: string; to: string }) => void
}

export type ConstructorDeskActions = {
  canSubmit: boolean
  canExport: boolean
  isLoading: boolean
  blockedReason: string | null
  ran: boolean
  previewNeedsExport: boolean
  excelUrl: string | null
  pdfUrl: string | null
  fileBaseName: string | null
  pending: boolean
  resetDisabled: boolean
  onPreview: () => void
  onGenerate: () => void
  onReset: () => void
  onCancel: () => void
  onSaveTemplate: () => void
  onLoadTemplate: () => void
}

type Props = {
  title: string
  templateName: string
  resolving: boolean
  warning: string | null
  period: ConstructorDeskPeriod | null
  currentStateNotice?: ReactNode
  parameters: ReactNode
  panels: ReactNode
  filters: ReactNode
  extras: ReactNode
  notices?: ReactNode
  actions: ConstructorDeskActions
  disabled: boolean
}

export function ConstructorDesk({ title, templateName, resolving, warning, period, currentStateNotice, parameters, panels, filters, extras, notices, actions, disabled }: Props) {
  const [parametersOpen, setParametersOpen] = useState(true)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const blocked = !actions.canSubmit && !actions.isLoading && actions.blockedReason ? actions.blockedReason : null
  const describedBy = blocked ? BLOCKED_REASON_ID : undefined
  const generate = <Button type="button" color={CREATE_ACTION_COLOR} leftSection={<Play size={15} aria-hidden="true" />}
    disabled={!actions.canSubmit || actions.isLoading} aria-describedby={describedBy} onClick={actions.onPreview}>Сформувати</Button>
  const file = (format: 'excel' | 'pdf', url: string | null) => {
    const label = format === 'excel' ? 'Excel' : 'PDF'
    const icon = format === 'excel' ? <ExcelIcon size={16} /> : <PdfIcon size={18} />
    if (url) return <Button component="a" variant="default" className="constructor-desk__file is-ready" leftSection={icon}
      href={getDocumentHref(url)} target="_blank" rel="noreferrer" download={deskDownloadName(actions.fileBaseName, url, format)}
      aria-label={`Завантажити ${label}`}>{label}</Button>
    const missing = actions.ran && !actions.isLoading && !actions.previewNeedsExport
    return <Button type="button" variant="default" className="constructor-desk__file" leftSection={icon}
      disabled={!actions.canExport || actions.isLoading || missing} aria-describedby={describedBy}
      title={missing ? `Сервер не повернув файл ${label} для цього звіту.` : undefined}
      aria-label={`Сформувати ${label}`} onClick={actions.onGenerate}>{label}</Button>
  }
  const missingFile = Boolean(actions.excelUrl) !== Boolean(actions.pdfUrl)
  return <section className="constructor-desk" aria-label={title}>
    <header className="constructor-desk__header">
      <div className="constructor-desk__heading">
        <FileChartColumn size={22} aria-hidden="true" />
        <h2 className="constructor-desk__title">{title}</h2>
        {templateName.trim() ? <span className="constructor-desk__template">Шаблон «{templateName.trim()}»</span> : null}
        {resolving ? <span role="status" aria-label="Завантаження"><Loader size={16} aria-hidden="true" /></span> : null}
      </div>
      <div className="constructor-desk__header-actions">
        <Button type="button" variant="default" leftSection={<Save size={15} aria-hidden="true" />} disabled={actions.isLoading} onClick={actions.onSaveTemplate}>Зберегти шаблон</Button>
        <Button type="button" variant="default" leftSection={<Download size={15} aria-hidden="true" />} disabled={actions.isLoading} onClick={actions.onLoadTemplate}>Завантажити шаблон</Button>
        {generate}
      </div>
    </header>
    {warning ? <p className="constructor-desk__warning" role="status"><CircleAlert size={16} aria-hidden="true" /><span>{warning}</span></p> : null}
    <fieldset className="constructor-desk__body" disabled={disabled}>
      {period ? <div className="constructor-desk__period" role="group" aria-label="Період" aria-describedby={period.error ? 'constructor-period-error' : undefined}>
        <span className="constructor-desk__period-label" aria-hidden="true">Період</span>
        <TextInput type="date" size="xs" aria-label="Початок періоду" value={period.from} min={period.minDate} max={period.to || period.maxDate}
          disabled={period.disabled} onChange={event => period.onChange({ from: event.currentTarget.value, to: period.to })} />
        <span aria-hidden="true">–</span>
        <TextInput type="date" size="xs" aria-label="Кінець періоду" value={period.to} min={period.from || period.minDate} max={period.maxDate}
          disabled={period.disabled} onChange={event => period.onChange({ from: period.from, to: event.currentTarget.value })} />
        <ToolbarDateRangeFilter trigger="more" from={period.from} to={period.to} min={period.minDate} max={period.maxDate}
          disabled={period.disabled} required onChange={period.onChange} />
        {period.error ? <p id="constructor-period-error" className="constructor-desk__period-error" role="alert">{period.error}</p> : null}
      </div> : currentStateNotice}
      <section className="constructor-panel constructor-parameters" aria-label="Параметри показників">
        <div className="constructor-section-head">
          <h3 className="constructor-panel__title">Параметри показників</h3>
          <ActionIcon type="button" variant="subtle" color="gray" size={24} aria-expanded={parametersOpen}
            aria-label={parametersOpen ? 'Згорнути параметри показників' : 'Розгорнути параметри показників'} onClick={() => setParametersOpen(value => !value)}>
            {parametersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </ActionIcon>
        </div>
        <div className="constructor-parameters__list" hidden={!parametersOpen}>{parameters}</div>
      </section>
      <div className="constructor-desk__panels">{panels}</div>
      {filters}
      <section id="constructor-extras" className="constructor-panel constructor-extras" aria-label="Додаткові налаштування" hidden={!extrasOpen}>{extras}</section>
    </fieldset>
    {notices}
    <footer className="constructor-desk__footer">
      <div className="constructor-desk__footer-start">
        <Button type="button" variant="subtle" color="dark" leftSection={<><span className="constructor-desk__chevron">{extrasOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}</span><Settings size={16} aria-hidden="true" /></>}
          aria-expanded={extrasOpen} aria-controls="constructor-extras" onClick={() => setExtrasOpen(value => !value)}>Додаткові налаштування</Button>
        <Button type="button" variant="subtle" color="gray" size="compact-sm" leftSection={<RotateCcw size={14} aria-hidden="true" />}
          title="Повернути період і відбори за замовчуванням" disabled={actions.resetDisabled} onClick={actions.onReset}>Скинути</Button>
        <Button type="button" variant="subtle" color="gray" size="compact-sm" leftSection={<Undo2 size={14} aria-hidden="true" />}
          disabled={!actions.pending || actions.isLoading} onClick={actions.onCancel}>Скасувати зміни</Button>
      </div>
      <div className="constructor-desk__footer-actions">
        {file('excel', actions.excelUrl)}
        {file('pdf', actions.pdfUrl)}
        {generate}
      </div>
    </footer>
    <div className="constructor-desk__status" aria-live="polite">
      {actions.isLoading ? <span className="constructor-desk__note is-busy"><Loader size={14} />Звіт формується…</span>
        : blocked ? <span id={BLOCKED_REASON_ID} className="constructor-desk__note is-blocked"><CircleAlert size={16} aria-hidden="true" /><span>{blocked}</span></span>
        : missingFile ? <span className="constructor-desk__note is-ready"><CircleCheck size={16} aria-hidden="true" />
          <span>{`Готовий лише файл ${actions.excelUrl ? 'Excel' : 'PDF'}: сервер не повернув ${actions.excelUrl ? 'PDF' : 'Excel'}.`}</span></span> : null}
    </div>
  </section>
}
