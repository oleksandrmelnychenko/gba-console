import { ToolbarDateRangeFilter } from '../../../../shared/ui/ToolbarDateRangeFilter'
import { Button, Select } from '@mantine/core'
import { Building2, ChartNoAxesCombined, ChevronDown, ChevronRight, ChevronUp, ListFilter, ListTree, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import '../../../../shared/ui/selection-surface.css'
import type { ReportPeriodPreset } from '../../data/bug1274WorkbookGuide'

const SECTION_ICONS: Record<string, ReactNode> = {
  organizations: <Building2 size={16} aria-hidden="true" />,
  filters: <ListFilter size={16} aria-hidden="true" />,
  measures: <ChartNoAxesCombined size={16} aria-hidden="true" />,
  grouping: <ListTree size={16} aria-hidden="true" />,
  advanced: <SlidersHorizontal size={16} aria-hidden="true" />,
}

export type WorkbookSettingsSection = {
  id: string
  title: string
  summary: string
  compactSummary?: string
  content: ReactNode
}

type Props = {
  sections: readonly WorkbookSettingsSection[]
  advanced: ReactNode
  disabled?: boolean
  unified?: boolean
  period?: ReactNode
}

export function WorkbookSettings({ sections, advanced, disabled = false, unified = false, period }: Props) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const activeSection = selectedSection === 'advanced' || sections.some(section => section.id === selectedSection)
    ? selectedSection : sections[0]?.id ?? 'advanced'
  const panes = [...sections, { id: 'advanced', title: 'Додатково', content: advanced }]
  function reveal(id: string) {
    setSelectedSection(id)
    setExpanded(true)
    window.requestAnimationFrame(() => {
      const heading = document.getElementById(`workbook-settings-${id}`)
      heading?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      heading?.focus({ preventScroll: true })
    })
  }
  if (unified) return <section className="workbook-settings workbook-settings--unified" aria-label={t('Налаштування звіту')}>
    <h2 className="app-section-title">{t('Налаштування звіту')}</h2>
    {period ? <fieldset className="workbook-settings__control" disabled={disabled}>{period}</fieldset> : null}
    <div className="workbook-settings__grid">
      {sections.map(section => <section key={section.id} id={`workbook-settings-pane-${section.id}`}
        className={`workbook-settings__unified-section workbook-settings__unified-section--${section.id}`}
        role="group" aria-label={t(section.title)}>
        <fieldset className="workbook-settings__control" disabled={disabled}>{section.content}</fieldset>
      </section>)}
    </div>
    <details className="workbook-settings__advanced"><summary>{t('Додатково')}</summary>
      <fieldset className="workbook-settings__control" disabled={disabled}>{advanced}</fieldset>
    </details>
  </section>
  return <section className="workbook-settings" aria-labelledby="workbook-settings-title">
    <div className="workbook-settings__head">
      <h2 id="workbook-settings-title" className="app-section-title workbook-settings__title">{t('Налаштування звіту')}</h2>
      <Button type="button" variant="subtle" color="gray" size="compact-sm" className="workbook-settings__toggle"
        aria-expanded={expanded} aria-controls="workbook-settings-body"
        rightSection={expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        onClick={() => setExpanded(value => !value)}>
        {expanded ? t('Згорнути налаштування') : t('Змінити налаштування')}
      </Button>
    </div>
    {!expanded ? <ul className="workbook-settings__summary" aria-label={t('Коротко про налаштування')}>
      {sections.map(section => <li key={section.id}>
        <button type="button" className="workbook-settings__summary-item" onClick={() => reveal(section.id)}
          aria-label={`${t(section.title)}: ${section.summary}`}
          aria-expanded={false} aria-controls="workbook-settings-body">
          <span className="workbook-settings__summary-title">{t(section.title)}</span>
          <span className="workbook-settings__summary-text">{section.compactSummary ?? section.summary}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </li>)}
    </ul> : null}
    <div id="workbook-settings-body" className="workbook-settings__body" hidden={!expanded}>
      <nav className="workbook-settings__nav" aria-label={t('Розділи налаштувань звіту')}>
        {panes.map(section => <button key={section.id} type="button"
          className="app-selection-surface workbook-settings__nav-item" data-selected={activeSection === section.id} aria-current={activeSection === section.id ? 'true' : undefined}
          aria-controls={`workbook-settings-pane-${section.id}`} onClick={() => setSelectedSection(section.id)}>
          <span className="app-selection-surface__marker" aria-hidden="true" />
          {SECTION_ICONS[section.id]}
          <span className="workbook-settings__nav-label">{t(section.title)}</span>
          {activeSection === section.id ? <ChevronRight size={14} aria-hidden="true" /> : null}
        </button>)}
      </nav>
      <div className="workbook-settings__panes">
        {panes.map(section => <section key={section.id} id={`workbook-settings-pane-${section.id}`}
          className="workbook-settings__pane" hidden={activeSection !== section.id}
          role="group" aria-labelledby={`workbook-settings-${section.id}`}>
          <h3 id={`workbook-settings-${section.id}`} className="workbook-settings__pane-title" tabIndex={-1}>{t(section.title)}</h3>
          <fieldset className="workbook-settings__control" disabled={disabled}>
            {section.content}
          </fieldset>
        </section>)}
      </div>
    </div>
  </section>
}

type PeriodProps = {
  disabled?: boolean
  from: string
  to: string
  minDate: string
  maxDate: string
  presets: readonly ReportPeriodPreset[]
  error: string | null
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export function WorkbookPeriodField({ from, to, minDate, maxDate, presets, error, disabled, onFromChange, onToChange }: PeriodProps) {
  const { t } = useI18n()
  const activePreset = presets.find(preset => preset.from === from && preset.to === to)
  return <div className="workbook-period">
    {presets.length ? <Select classNames={{ dropdown: 'reports-toolbar-dropdown' }} className="workbook-period__presets" label={t('Період')} placeholder={t('Довільний період')}
      data={presets.map(preset => ({ value: preset.label, label: t(preset.label) }))}
      value={activePreset?.label ?? null} allowDeselect={false} disabled={disabled}
      onChange={value => {
        const preset = presets.find(item => item.label === value)
        if (preset) { onFromChange(preset.from); onToChange(preset.to) }
      }} /> : null}
    <div role="group" aria-label={t('Період')} aria-describedby={error ? 'workbook-period-error' : undefined}>
      <ToolbarDateRangeFilter from={from} to={to} min={minDate} max={maxDate} disabled={disabled}
        onChange={range => { onFromChange(range.from); onToChange(range.to) }} />
    </div>
    {error ? <p id="workbook-period-error" className="workbook-period__error" role="alert">{error}</p> : null}
  </div>
}
