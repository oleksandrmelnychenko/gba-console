import { Badge, Button, Text, Title } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useRef } from 'react'

export type ReportConstructorSection = 'structure' | 'filters' | 'analysis' | 'result'

export function ReportSectionPanel({ active, section, className, children }: {
  active?: ReportConstructorSection; section: ReportConstructorSection; className?: string; children: ReactNode
}) {
  return <div className={className} hidden={Boolean(active && active !== section)} role={active ? 'tabpanel' : undefined}
    id={active ? `report-constructor-panel-${section}` : undefined}
    aria-labelledby={active ? `report-constructor-tab-${section}` : undefined}>{children}</div>
}

const sections = [
  { id: 'structure', label: 'Структура звіту' },
  { id: 'filters', label: 'Умови відбору' },
  { id: 'analysis', label: 'Аналіз і сортування' },
  { id: 'result', label: 'Результат' },
] as const

export function ReportConstructorHeader({ name }: { name: string }) {
  return <header className="report-constructor-header">
    <div>
      <Title order={2}>Конструктор звітів</Title>
      <Text size="xs" c="gray.7">{name.trim() || 'Оберіть готові налаштування або налаштуйте власний звіт.'}</Text>
    </div>
    <Button component="a" href="/reports/registers" variant="default" size="xs">Звіти регістрів</Button>
  </header>
}

type Props = {
  active: ReportConstructorSection
  onChange: (section: ReportConstructorSection) => void
  measures: number
  rows: number
  filters: number
  analysis: number
  hasResult: boolean
  loading: boolean
  ready: boolean
  reason: string
}

export function ReportConstructorNavigation({ active, onChange, measures, rows, filters, analysis, hasResult, loading, ready, reason }: Props) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const counts: Record<ReportConstructorSection, string> = {
    structure: `${measures} / ${rows}`, filters: String(filters), analysis: String(analysis), result: hasResult ? '1' : '',
  }
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
      : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % sections.length
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : null
    if (next === null) return
    event.preventDefault()
    onChange(sections[next].id)
    buttons.current[next]?.focus()
  }
  return <aside className="report-constructor-sidebar">
    <Text className="app-section-title" fw={600} size="sm">Налаштування</Text>
    <div className="report-constructor-navigation" role="tablist" aria-label="Розділи конструктора" aria-orientation="vertical">
      {sections.map((section, index) => <button key={section.id} type="button" role="tab"
        className={`report-constructor-tab${active === section.id ? ' is-active' : ''}`}
        id={`report-constructor-tab-${section.id}`} aria-controls={`report-constructor-panel-${section.id}`}
        aria-selected={active === section.id} tabIndex={active === section.id ? 0 : -1}
        ref={node => { buttons.current[index] = node }} onKeyDown={event => navigate(event, index)}
        onClick={() => onChange(section.id)}>
        <span>{section.label}<ChevronRight size={14} aria-hidden="true" /></span>
        <small aria-hidden="true">{counts[section.id]}</small>
      </button>)}
    </div>
    <div className="report-constructor-readiness" role="status" aria-live="polite">
      <Badge className={`app-role-pill ${loading ? 'is-orange' : ready ? 'is-green' : 'is-gray'}`} variant="light">
        {loading ? 'Формується' : ready ? 'Готовий до формування' : 'Потрібні налаштування'}
      </Badge>
      <Text size="xs" c="gray.7">{loading ? 'Готуємо файл звіту. Можна переглянути налаштування.' : ready
        ? 'Натисніть «Сформувати», щоб отримати Excel або PDF.' : reason}</Text>
      <dl className="report-constructor-summary">
        <div><dt>Показники</dt><dd>{measures}</dd></div>
        <div><dt>Поля рядків</dt><dd>{rows}</dd></div>
        <div><dt>Активні умови</dt><dd>{filters}</dd></div>
      </dl>
    </div>
  </aside>
}

export function ReportConstructorResultEmpty({ loading, ready, reason, onConfigure }: {
  loading: boolean; ready: boolean; reason: string; onConfigure: () => void
}) {
  return <section className="app-section-card report-constructor-result-empty" aria-label="Стан результату">
    <Text className="app-section-title" component="h2" fw={600}>Результат</Text>
    <Text fw={600}>{loading ? 'Формуємо звіт' : 'Звіт ще не сформовано'}</Text>
    <Text size="sm" c="gray.7">{loading ? 'Після завершення тут з’явиться результат і доступ до файлів.'
      : ready ? 'Налаштування готові. Натисніть «Сформувати» у верхній панелі.' : reason}</Text>
    {!loading && !ready ? <Button type="button" variant="default" onClick={onConfigure}>Перейти до налаштувань</Button> : null}
  </section>
}
