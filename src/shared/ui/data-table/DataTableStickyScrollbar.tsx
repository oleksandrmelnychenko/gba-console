import { type KeyboardEvent, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import {
  createHorizontalScrollLink,
  getClippingAncestors,
  getHorizontalScrollbarThickness,
  getStickyScrollbarLayout,
  getVerticalWheelTarget,
  getVisibleClipRect,
  getWheelDeltaPixels,
  measureMaxScrollLeft,
} from './stickyScrollbarGeometry'

const INTERSECTION_THRESHOLDS = Array.from({ length: 11 }, (_, index) => index / 10)

export function DataTableStickyScrollbar({ scrollElement }: { scrollElement: HTMLElement | null }) {
  const { t } = useI18n()
  const barRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    const content = contentRef.current
    const scroll = scrollElement

    if (!scroll || !bar || !content) {
      return undefined
    }

    const view = scroll.ownerDocument.defaultView ?? window
    let clippingAncestors = getClippingAncestors(scroll)
    let isVisible = false
    let frame = 0
    let measuredRange = ''
    let maxScrollLeft = 0
    const link = createHorizontalScrollLink(scroll, bar, () => isVisible)

    const update = () => {
      frame = 0
      const barHeight = getHorizontalScrollbarThickness(scroll)
      // macOS overlay scrollbars consume no layout space. Reserve the fixed
      // control's height inside the viewport so it cannot cover the final row.
      const nativeBarHeight = Math.max(0, scroll.offsetHeight - scroll.clientHeight - scroll.clientTop * 2)
      const bottomInset = scroll.scrollWidth > scroll.clientWidth
        ? Math.max(0, barHeight - nativeBarHeight)
        : 0
      scroll.style.setProperty('--data-table-sticky-scrollbar-inset', `${bottomInset}px`)
      const layout = getStickyScrollbarLayout({
        barHeight,
        clientWidth: scroll.clientWidth,
        clipRect: getVisibleClipRect(clippingAncestors, { height: view.innerHeight, width: view.innerWidth }),
        scrollRect: scroll.getBoundingClientRect(),
        scrollWidth: scroll.scrollWidth,
      })

      if (!layout.visible) {
        isVisible = false
        bar.dataset.visible = 'false'
        return
      }

      const range = `${scroll.scrollWidth}:${scroll.clientWidth}:${scroll.offsetWidth}`

      if (range !== measuredRange) {
        measuredRange = range
        maxScrollLeft = measureMaxScrollLeft(scroll)
      }

      const placed = bar.getBoundingClientRect()
      const originTop = placed.top - (Number.parseFloat(bar.style.top) || 0)
      const originLeft = placed.left - (Number.parseFloat(bar.style.left) || 0)

      bar.style.height = `${barHeight}px`
      bar.style.left = `${layout.left - originLeft}px`
      bar.style.top = `${layout.top - originTop}px`
      bar.style.width = `${layout.width}px`
      content.style.width = `${layout.width + maxScrollLeft}px`
      bar.dataset.visible = 'true'
      isVisible = true
      link.alignBar()
    }

    const scheduleUpdate = () => {
      if (!frame) {
        frame = view.requestAnimationFrame(update)
      }
    }

    const refreshAncestors = () => {
      clippingAncestors = getClippingAncestors(scroll)
      scheduleUpdate()
    }

    const handleBarWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }

      const target = getVerticalWheelTarget(scroll, event.deltaY)

      if (!target) {
        return
      }

      event.preventDefault()
      target.scrollTop += getWheelDeltaPixels(event, target.clientHeight)
    }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate)
    const intersectionObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(scheduleUpdate, { threshold: INTERSECTION_THRESHOLDS })
    const table = scroll.querySelector('table')

    scroll.addEventListener('scroll', link.handleTableScroll, { passive: true })
    bar.addEventListener('scroll', link.handleBarScroll, { passive: true })
    bar.addEventListener('wheel', handleBarWheel, { passive: false })
    view.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })
    view.addEventListener('resize', refreshAncestors)
    resizeObserver?.observe(scroll)
    if (table) {
      resizeObserver?.observe(table)
    }
    clippingAncestors.forEach((ancestor) => resizeObserver?.observe(ancestor))
    intersectionObserver?.observe(scroll)
    update()

    return () => {
      if (frame) {
        view.cancelAnimationFrame(frame)
      }
      scroll.removeEventListener('scroll', link.handleTableScroll)
      bar.removeEventListener('scroll', link.handleBarScroll)
      bar.removeEventListener('wheel', handleBarWheel)
      view.removeEventListener('scroll', scheduleUpdate, { capture: true })
      view.removeEventListener('resize', refreshAncestors)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      bar.dataset.visible = 'false'
      scroll.style.removeProperty('--data-table-sticky-scrollbar-inset')
    }
  }, [scrollElement])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!scrollElement || !['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? scrollElement.scrollWidth
        : scrollElement.scrollLeft + (event.key === 'ArrowLeft' ? -40 : 40)
    // DOM scrolling is imperative; this does not mutate React-owned data.
    // eslint-disable-next-line react-hooks/immutability
    scrollElement.scrollLeft = next
    event.currentTarget.scrollLeft = scrollElement.scrollLeft
  }

  return (
    <div
      ref={barRef}
      aria-label={t('Горизонтальна прокрутка таблиці')}
      className="data-table-sticky-scrollbar"
      data-visible="false"
      onKeyDown={handleKeyDown}
      role="region"
      tabIndex={0}
    >
      <div ref={contentRef} className="data-table-sticky-scrollbar-content" />
    </div>
  )
}
