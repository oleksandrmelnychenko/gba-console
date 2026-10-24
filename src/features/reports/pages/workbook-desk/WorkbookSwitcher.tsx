import { ActionIcon, VisuallyHidden } from '@mantine/core'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { publishedReportTabs, type PublishedReportTab } from './publishedReportTabs'
import { workbookDisplayFileName } from '../../data/bug1274WorkbookGuide'
import { workbookIcon } from './workbookIcons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { workbookDeskEntry } from '../../data/workbookDesk'

type Props = {
  compact?: boolean
  launches: readonly WorkbookLaunch[]
  active: string | null
  disabled: boolean
  published?: PublishedReportTab | null
  onOpenPublished?: (tab: PublishedReportTab) => void
  extra: ReactNode
  onOpen: (launch: WorkbookLaunch) => void
}

export function WorkbookSwitcher({ compact = false, launches, active, disabled, extra, onOpen, published, onOpenPublished }: Props) {
  const { t } = useI18n()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ overflow: false, left: false, right: false })
  const measure = () => {
    const tabs = tabsRef.current
    if (!tabs) return
    const max = tabs.scrollWidth - tabs.clientWidth
    setScroll({ overflow: max > 1, left: tabs.scrollLeft > 1, right: tabs.scrollLeft < max - 1 })
  }
  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return
    const revealActive = () => {
      const current = tabs.querySelector<HTMLElement>('[aria-current="true"]')
      if (current) {
        const view = tabs.getBoundingClientRect(), item = current.getBoundingClientRect()
        if (item.left < view.left + 6) tabs.scrollLeft += item.left - view.left - 6
        else if (item.right > view.right - 6) tabs.scrollLeft += item.right - view.right + 6
      }
      measure()
    }
    const observer = new ResizeObserver(revealActive)
    observer.observe(tabs)
    revealActive()
    return () => observer.disconnect()
  }, [active, published, launches.length])
  const scrollTabs = (direction: number) => {
    const tabs = tabsRef.current
    if (tabs) tabs.scrollBy({ left: direction * Math.max(tabs.clientWidth * 0.7, 160), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return <nav className="workbook-switcher" aria-label={t('Звіти')}>
    {compact ? <><VisuallyHidden><h2>{t('Звіти')}</h2></VisuallyHidden>{extra}</> : <div className="workbook-switcher__toolbar">
      <h2 className="app-section-title workbook-switcher__title">{t('Звіти')}</h2>
      <div className="workbook-switcher__extra">{extra}</div>
    </div>}
    <div className="workbook-switcher__navigation">
      {scroll.overflow && <ActionIcon className="workbook-switcher__scroll" variant="default" size={32} aria-label={t('Попередні звіти')} disabled={!scroll.left} onClick={() => scrollTabs(-1)}><ChevronLeft size={18} /></ActionIcon>}
    <div ref={tabsRef} onScroll={measure} className="workbook-switcher__tabs app-screen-tabs">
      {launches.map(launch => {
        const current = launch.fileName === active
        const Icon = workbookIcon(launch.fileName, launch.dataset.DataSource)
        return <button key={launch.fileName} type="button" className={`app-screen-tab${current ? ' is-active' : ''}`}
          aria-current={current ? 'true' : undefined} disabled={disabled} title={workbookDisplayFileName(launch.fileName)}
          aria-label={t('Відкрити {file}', { file: workbookDisplayFileName(launch.fileName) })} onClick={() => { if (!current) onOpen(launch) }}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
          {t(workbookDeskEntry(launch.fileName)?.name ?? launch.label)}
        </button>
      })}
      {onOpenPublished ? publishedReportTabs.map(tab => {
        const current = published === tab.key, Icon = tab.key === 'movement' ? ArrowLeftRight : Users
        return <button key={tab.key} type="button" className={`app-screen-tab${current ? ' is-active' : ''}`}
          disabled={disabled} aria-current={current ? 'true' : undefined} onClick={() => { if (!current) onOpenPublished(tab.key) }}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />{t(tab.title)}
        </button>
      }) : null}
    </div>
      {scroll.overflow && <ActionIcon className="workbook-switcher__scroll" variant="default" size={32} aria-label={t('Наступні звіти')} disabled={!scroll.right} onClick={() => scrollTabs(1)}><ChevronRight size={18} /></ActionIcon>}
    </div>
  </nav>
}
