import { Button, TextInput } from '@mantine/core'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ReportPeriodPreset } from '../../data/bug1274WorkbookGuide'

export type WorkbookSettingsSection = { id: string; title: string; summary: string; content: ReactNode }

type Props = {
  period: ReactNode
  sections: readonly WorkbookSettingsSection[]
  advanced: ReactNode
}

export function WorkbookSettings({ period, sections, advanced }: Props) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  function reveal(id: string) {
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
    <div className="workbook-settings__row is-period" role="group" aria-labelledby="workbook-settings-period">
      <div className="workbook-settings__label"><h3 id="workbook-settings-period" tabIndex={-1}>{t('Період')}</h3></div>
      <div className="workbook-settings__control">{period}</div>
    </div>
    {!expanded ? <ul className="workbook-settings__summary" aria-label={t('Коротко про налаштування')}>
      {sections.map(section => <li key={section.id}>
        <button type="button" className="workbook-settings__summary-item" onClick={() => reveal(section.id)}
          aria-label={`${t(section.title)}: ${section.summary}`}>
          <span className="workbook-settings__summary-title">{t(section.title)}</span>
          <span className="workbook-settings__summary-text">{section.summary}</span>
        </button>
      </li>)}
    </ul> : null}
    <div id="workbook-settings-body" className="workbook-settings__body" hidden={!expanded}>
      {sections.map(section => <div key={section.id} className="workbook-settings__row" role="group"
        aria-labelledby={`workbook-settings-${section.id}`}>
        <div className="workbook-settings__label">
          <h3 id={`workbook-settings-${section.id}`} tabIndex={-1}>{t(section.title)}</h3>
          <p>{section.summary}</p>
        </div>
        <div className="workbook-settings__control">{section.content}</div>
      </div>)}
      <details className="workbook-settings__advanced">
        <summary><span>{t('Додатково')}</span><small>{t('джерело розрахунку, логіка умов, інші форми')}</small></summary>
        <div className="workbook-settings__advanced-body">{advanced}</div>
      </details>
    </div>
  </section>
}

type PeriodProps = {
  from: string
  to: string
  minDate: string
  maxDate: string
  presets: readonly ReportPeriodPreset[]
  error: string | null
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export function WorkbookPeriodField({ from, to, minDate, maxDate, presets, error, onFromChange, onToChange }: PeriodProps) {
  const { t } = useI18n()
  return <div className="workbook-period">
    <div className="workbook-period__dates">
      <TextInput label={t('Від')} type="date" min={minDate} max={to || maxDate} value={from}
        error={Boolean(error)} onChange={event => onFromChange(event.currentTarget.value)} />
      <span className="workbook-period__dash" aria-hidden="true">–</span>
      <TextInput label={t('До')} type="date" min={from || minDate} max={maxDate} value={to}
        error={Boolean(error)} onChange={event => onToChange(event.currentTarget.value)} />
    </div>
    {presets.length ? <div className="workbook-period__presets" role="group" aria-label={t('Швидкий період')}>
      {presets.map(preset => {
        const active = preset.from === from && preset.to === to
        return <Button key={preset.label} type="button" size="compact-sm" variant={active ? 'light' : 'default'}
          className={`workbook-period__preset${active ? ' is-active' : ''}`} aria-pressed={active}
          onClick={() => { onFromChange(preset.from); onToChange(preset.to) }}>{t(preset.label)}</Button>
      })}
    </div> : null}
    {error ? <p className="workbook-period__error">{error}</p> : null}
  </div>
}
