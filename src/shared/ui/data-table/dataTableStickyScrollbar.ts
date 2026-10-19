export const DEFAULT_STICKY_SCROLLBAR_HEIGHT = 10

export type StickyScrollbarRect = {
  bottom: number
  left: number
  right: number
  top: number
}

export type StickyScrollbarMetrics = {
  barHeight: number
  clientWidth: number
  clipRect: StickyScrollbarRect
  scrollRect: StickyScrollbarRect
  scrollWidth: number
}

export type StickyScrollbarLayout =
  | { visible: false }
  | {
      left: number
      top: number
      visible: true
      width: number
    }

const HIDDEN_LAYOUT: StickyScrollbarLayout = { visible: false }

export function getStickyScrollbarLayout({
  barHeight,
  clientWidth,
  clipRect,
  scrollRect,
  scrollWidth,
}: StickyScrollbarMetrics): StickyScrollbarLayout {
  const overflowWidth = scrollWidth - clientWidth
  const left = Math.max(scrollRect.left, clipRect.left)
  const right = Math.min(scrollRect.right, clipRect.right)
  const top = clipRect.bottom - barHeight

  if (overflowWidth < 1 || right - left < 1) {
    return HIDDEN_LAYOUT
  }

  if (scrollRect.bottom <= clipRect.bottom + 0.5) {
    return HIDDEN_LAYOUT
  }

  if (top < Math.max(scrollRect.top, clipRect.top)) {
    return HIDDEN_LAYOUT
  }

  return { left, top, visible: true, width: right - left }
}

export function getClippingAncestors(element: Element): HTMLElement[] {
  const ancestors: HTMLElement[] = []
  const root = element.ownerDocument.documentElement
  let node = element.parentElement

  while (node && node !== root) {
    const style = getComputedStyle(node)

    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      ancestors.push(node)
    }

    node = node.parentElement
  }

  return ancestors
}

export function getVisibleClipRect(
  ancestors: readonly HTMLElement[],
  viewport: { height: number; width: number },
): StickyScrollbarRect {
  const clip = { bottom: viewport.height, left: 0, right: viewport.width, top: 0 }

  ancestors.forEach((ancestor) => {
    const rect = ancestor.getBoundingClientRect()
    const top = rect.top + ancestor.clientTop
    const left = rect.left + ancestor.clientLeft

    clip.top = Math.max(clip.top, top)
    clip.left = Math.max(clip.left, left)
    clip.bottom = Math.min(clip.bottom, top + ancestor.clientHeight)
    clip.right = Math.min(clip.right, left + ancestor.clientWidth)
  })

  return clip
}

export function measureMaxScrollLeft(element: HTMLElement) {
  const current = element.scrollLeft

  element.scrollLeft = element.scrollWidth
  const max = element.scrollLeft
  element.scrollLeft = current

  return max
}

export function getHorizontalScrollbarThickness(element: HTMLElement) {
  const thickness = element.offsetHeight - element.clientHeight - element.clientTop * 2

  return thickness > 0 ? thickness : DEFAULT_STICKY_SCROLLBAR_HEIGHT
}

const WHEEL_LINE_HEIGHT = 16

export function getWheelDeltaPixels(
  event: Pick<WheelEvent, 'deltaMode' | 'deltaY'>,
  pageHeight: number,
) {
  if (event.deltaMode === 1) {
    return event.deltaY * WHEEL_LINE_HEIGHT
  }

  if (event.deltaMode === 2) {
    return event.deltaY * pageHeight
  }

  return event.deltaY
}

export function getVerticalWheelTarget(start: HTMLElement, deltaY: number): HTMLElement | null {
  const root = start.ownerDocument.documentElement
  let node: HTMLElement | null = start

  while (node && node !== root) {
    const { overflowY } = getComputedStyle(node)
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll'
    const canScroll = deltaY > 0
      ? node.scrollTop + node.clientHeight < node.scrollHeight - 1
      : node.scrollTop > 0

    if (isScrollable && canScroll) {
      return node
    }

    node = node.parentElement
  }

  return null
}

export function createHorizontalScrollLink(
  table: HTMLElement,
  bar: HTMLElement,
  canBarDrive: () => boolean,
) {
  const pendingScrollLeft = new Map<HTMLElement, number>()

  function assign(target: HTMLElement, scrollLeft: number) {
    if (Math.abs(target.scrollLeft - scrollLeft) < 1) {
      return
    }

    pendingScrollLeft.set(target, scrollLeft)
    target.scrollLeft = scrollLeft
  }

  function isEcho(source: HTMLElement) {
    const pending = pendingScrollLeft.get(source)

    if (pending === undefined) {
      return false
    }

    pendingScrollLeft.delete(source)

    return Math.abs(source.scrollLeft - pending) < 1
  }

  return {
    alignBar() {
      assign(bar, table.scrollLeft)
    },
    handleBarScroll() {
      if (!isEcho(bar) && canBarDrive()) {
        assign(table, bar.scrollLeft)
      }
    },
    handleTableScroll() {
      if (!isEcho(table)) {
        assign(bar, table.scrollLeft)
      }
    },
  }
}
