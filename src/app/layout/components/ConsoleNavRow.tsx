import { Menu } from '@mantine/core'
import { ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { fitConsoleNavEntries, sameConsoleNavMeasure, type ConsoleNavMeasure } from './consoleNavFit'

export type ConsoleNavEntry = {
  key: string
  label: string
  disabled?: boolean
  active: boolean
  badge: ReactNode
  onSelect: () => void
}

type Props = {
  kind: 'module' | 'item'
  className: string
  entries: ConsoleNavEntry[]
  availableWidth?: number
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function ConsoleNavRow({ kind, className, entries, availableWidth }: Props) {
  const { t } = useI18n()
  const measurer = useRef<HTMLSpanElement>(null)
  const [measure, setMeasure] = useState<ConsoleNavMeasure | null>(null)
  const fitting = availableWidth !== undefined
  const signature = entries.map(entry => `${entry.key}\u0000${entry.label}`).join('\u0001')

  useLayoutEffect(() => {
    const node = measurer.current
    if (!fitting || !node) return
    const read = () => {
      const row = node.parentElement
      const pills = [...node.children] as HTMLElement[]
      const style = row ? getComputedStyle(row) : null
      const next: ConsoleNavMeasure = {
        items: pills.slice(0, -1).map(pill => Math.ceil(pill.getBoundingClientRect().width)),
        more: Math.ceil(pills.at(-1)?.getBoundingClientRect().width ?? 0),
        gap: pixels(style?.columnGap ?? ''),
        padding: pixels(style?.paddingLeft ?? '') + pixels(style?.paddingRight ?? ''),
      }
      setMeasure(current => sameConsoleNavMeasure(current, next) ? current : next)
    }
    read()
    const observer = new ResizeObserver(read)
    for (const pill of node.children) observer.observe(pill, { box: 'border-box' })
    return () => observer.disconnect()
  }, [fitting, signature])

  const activeIndex = entries.findIndex(entry => entry.active)
  const usable = fitting && measure && measure.items.length === entries.length && measure.items.some(width => width > 0)
  const visibleIndices = usable ? fitConsoleNavEntries(measure, availableWidth, activeIndex) : entries.map((_, index) => index)
  const visible = new Set(visibleIndices)
  const hidden = entries.filter((_, index) => !visible.has(index))
  const hiddenActive = hidden.some(entry => entry.active)
  const pillClass = `console-subnav-pill console-subnav-${kind}`

  return (
    <div className={className}>
      {entries.map((entry, index) => visible.has(index) ? (
        <button
          key={entry.key}
          type="button"
          className={`${pillClass}${entry.active ? ' is-active' : ''}`}
          disabled={entry.disabled}
          aria-pressed={entry.active}
          onClick={entry.onSelect}
        >
          <span>{entry.label}</span>
          {entry.badge}
        </button>
      ) : null)}
      {hidden.length > 0 && (
        <Menu position="bottom-end" offset={4} withinPortal shadow="md" radius="md">
          <Menu.Target>
            <button
              type="button"
              className={`${pillClass} console-subnav-more${hiddenActive ? ' is-active' : ''}`}
              title={hidden.map(entry => entry.label).join(', ')}
            >
              <span>{t('Ще')}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </Menu.Target>
          <Menu.Dropdown className="console-subnav-menu">
            {hidden.map(entry => (
              <Menu.Item
                key={entry.key}
                className={`console-subnav-menu-item${entry.active ? ' is-active' : ''}`}
                disabled={entry.disabled}
                aria-current={entry.active ? 'page' : undefined}
                rightSection={entry.badge}
                onClick={entry.onSelect}
              >
                {entry.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
      {fitting && (
        <span ref={measurer} className="console-subnav-measure" aria-hidden="true">
          {entries.map(entry => (
            <span key={entry.key} className={pillClass}>
              <span>{entry.label}</span>
              {entry.badge}
            </span>
          ))}
          <span className={`${pillClass} console-subnav-more`}>
            <span>{t('Ще')}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </span>
      )}
    </div>
  )
}
