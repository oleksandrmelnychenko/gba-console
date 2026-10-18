import { Button, Select, TextInput } from '@mantine/core'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ReportPeriodPreset } from '../../data/bug1274WorkbookGuide'

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
}

export function WorkbookSettings({ sections, advanced, disabled = false }: Props) {
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
          className="workbook-settings__nav-item" aria-current={activeSection === section.id ? 'true' : undefined}
          aria-controls={`workbook-settings-pane-${section.id}`} onClick={() => setSelectedSection(section.id)}>
          {t(section.title)}
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
    {presets.length ? <Select className="workbook-period__presets" label={t('Період')} placeholder={t('Довільний період')}
      data={presets.map(preset => ({ value: preset.label, label: t(preset.label) }))}
      value={activePreset?.label ?? null} allowDeselect={false} disabled={disabled}
      onChange={value => {
        const preset = presets.find(item => item.label === value)
        if (preset) { onFromChange(preset.from); onToChange(preset.to) }
      }} /> : null}
    <div className="app-filter-date-range">
      <TextInput label={t('Від')} type="date" min={minDate} max={to || maxDate} value={from}
        disabled={disabled} error={Boolean(error)} aria-describedby={error ? 'workbook-period-error' : undefined}
        onChange={event => onFromChange(event.currentTarget.value)} />
      <TextInput label={t('До')} type="date" min={from || minDate} max={maxDate} value={to}
        disabled={disabled} error={Boolean(error)} aria-describedby={error ? 'workbook-period-error' : undefined}
        onChange={event => onToChange(event.currentTarget.value)} />
    </div>
    {error ? <p id="workbook-period-error" className="workbook-period__error" role="alert">{error}</p> : null}
  </div>
}
