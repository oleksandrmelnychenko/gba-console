import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHorizontalScrollLink,
  DEFAULT_STICKY_SCROLLBAR_HEIGHT,
  getClippingAncestors,
  getHorizontalScrollbarThickness,
  getStickyScrollbarLayout,
  getVerticalWheelTarget,
  getVisibleClipRect,
  getWheelDeltaPixels,
  measureMaxScrollLeft,
  type StickyScrollbarMetrics,
} from './dataTableStickyScrollbar'

const workspaceClip = { bottom: 861, left: 268, right: 1425, top: 195 }

function metrics(overrides: Partial<StickyScrollbarMetrics> = {}): StickyScrollbarMetrics {
  return {
    barHeight: 10,
    clientWidth: 1081,
    clipRect: workspaceClip,
    scrollRect: { bottom: 1209, left: 292, right: 1393, top: 849 },
    scrollWidth: 1900,
    ...overrides,
  }
}

function scrollable(element: HTMLElement, initialLeft = 0) {
  let left = initialLeft
  const writes: number[] = []

  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (value: number) => {
      writes.push(value)
      left = value
    },
  })

  return {
    writes,
    userScroll(value: number) {
      left = value
    },
  }
}

function verticalScroller(element: HTMLElement, { clientHeight, scrollHeight, scrollTop }: { clientHeight: number; scrollHeight: number; scrollTop: number }) {
  element.style.overflowY = 'auto'
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(element, 'scrollTop', { configurable: true, value: scrollTop, writable: true })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('getStickyScrollbarLayout', () => {
  it('pins the bar to the bottom of the visible area with the table scroll box geometry', () => {
    expect(getStickyScrollbarLayout(metrics())).toEqual({
      left: 292,
      top: 851,
      visible: true,
      width: 1101,
    })
  })

  it('stays visible while only the table header edge is in view', () => {
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 1211, left: 292, right: 1393, top: 851 },
    })).visible).toBe(true)
  })

  it('hides once the table own horizontal scrollbar is inside the visible area', () => {
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 861, left: 292, right: 1393, top: 501 },
    }))).toEqual({ visible: false })
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 838, left: 292, right: 1393, top: 478 },
    }))).toEqual({ visible: false })
  })

  it('hides when the table has no horizontal overflow', () => {
    expect(getStickyScrollbarLayout(metrics({ clientWidth: 1900 }))).toEqual({ visible: false })
    expect(getStickyScrollbarLayout(metrics({ clientWidth: 1899.5 }))).toEqual({ visible: false })
  })

  it('hides when the table is entirely below or above the visible area', () => {
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 1300, left: 292, right: 1393, top: 940 },
    }))).toEqual({ visible: false })
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 1209, left: 292, right: 1393, top: 855 },
    }))).toEqual({ visible: false })
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 150, left: 292, right: 1393, top: -210 },
    }))).toEqual({ visible: false })
  })

  it('stays visible for a table taller than the visible area', () => {
    expect(getStickyScrollbarLayout(metrics({
      scrollRect: { bottom: 1600, left: 292, right: 1393, top: 100 },
    }))).toMatchObject({ top: 851, visible: true })
  })

  it('clips the bar horizontally to the visible area', () => {
    expect(getStickyScrollbarLayout(metrics({
      clipRect: { bottom: 861, left: 400, right: 1000, top: 195 },
    }))).toMatchObject({ left: 400, visible: true, width: 600 })
    expect(getStickyScrollbarLayout(metrics({
      clipRect: { bottom: 861, left: 1400, right: 1425, top: 195 },
    }))).toEqual({ visible: false })
  })
})

describe('getVisibleClipRect', () => {
  it('intersects the viewport with the client box of every clipping ancestor', () => {
    const outer = document.createElement('div')
    const workspace = document.createElement('div')

    vi.spyOn(outer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 120, 1440, 760))
    vi.spyOn(workspace, 'getBoundingClientRect').mockReturnValue(new DOMRect(268, 195, 1172, 666))
    Object.defineProperty(outer, 'clientHeight', { value: 760 })
    Object.defineProperty(outer, 'clientWidth', { value: 1440 })
    Object.defineProperty(workspace, 'clientHeight', { value: 666 })
    Object.defineProperty(workspace, 'clientWidth', { value: 1157 })

    expect(getVisibleClipRect([workspace, outer], { height: 900, width: 1440 })).toEqual({
      bottom: 861,
      left: 268,
      right: 1425,
      top: 195,
    })
  })

  it('falls back to the viewport without clipping ancestors', () => {
    expect(getVisibleClipRect([], { height: 720, width: 1280 })).toEqual({
      bottom: 720,
      left: 0,
      right: 1280,
      top: 0,
    })
  })
})

describe('getClippingAncestors', () => {
  it('collects every ancestor that clips overflow, nearest first', () => {
    const workspace = document.createElement('div')
    const frame = document.createElement('div')
    const plain = document.createElement('div')
    const scroll = document.createElement('div')

    workspace.style.overflowY = 'auto'
    frame.style.overflowX = 'hidden'
    frame.style.overflowY = 'hidden'
    workspace.append(frame)
    frame.append(plain)
    plain.append(scroll)
    document.body.append(workspace)

    expect(getClippingAncestors(scroll)).toEqual([frame, workspace])
  })
})

describe('measureMaxScrollLeft', () => {
  it('reads the reachable scroll range and restores the current position', () => {
    const table = document.createElement('div')
    let left = 120
    const writes: number[] = []

    Object.defineProperty(table, 'scrollWidth', { value: 1900 })
    Object.defineProperty(table, 'scrollLeft', {
      configurable: true,
      get: () => left,
      set: (value: number) => {
        writes.push(value)
        left = Math.min(Math.max(0, value), 809)
      },
    })

    expect(measureMaxScrollLeft(table)).toBe(809)
    expect(table.scrollLeft).toBe(120)
    expect(writes).toEqual([1900, 120])
  })
})

describe('getHorizontalScrollbarThickness', () => {
  it('mirrors the native scrollbar thickness of the table scroll box', () => {
    const scroll = document.createElement('div')

    Object.defineProperty(scroll, 'offsetHeight', { value: 360 })
    Object.defineProperty(scroll, 'clientHeight', { value: 349 })

    expect(getHorizontalScrollbarThickness(scroll)).toBe(11)
  })

  it('falls back to the shared thin scrollbar height for overlay scrollbars', () => {
    const scroll = document.createElement('div')

    Object.defineProperty(scroll, 'offsetHeight', { value: 360 })
    Object.defineProperty(scroll, 'clientHeight', { value: 360 })

    expect(getHorizontalScrollbarThickness(scroll)).toBe(DEFAULT_STICKY_SCROLLBAR_HEIGHT)
  })
})

describe('createHorizontalScrollLink', () => {
  it('mirrors table scrolling onto the bar without echoing it back', () => {
    const table = document.createElement('div')
    const bar = document.createElement('div')
    const tableScroll = scrollable(table)
    const barScroll = scrollable(bar)
    const link = createHorizontalScrollLink(table, bar, () => true)

    tableScroll.userScroll(240)
    link.handleTableScroll()
    link.handleBarScroll()

    expect(bar.scrollLeft).toBe(240)
    expect(barScroll.writes).toEqual([240])
    expect(tableScroll.writes).toEqual([])
  })

  it('drives the table from the bar and ignores the delayed table echo', () => {
    const table = document.createElement('div')
    const bar = document.createElement('div')
    const tableScroll = scrollable(table)
    const barScroll = scrollable(bar)
    const link = createHorizontalScrollLink(table, bar, () => true)

    barScroll.userScroll(510)
    link.handleBarScroll()
    barScroll.userScroll(520)
    link.handleTableScroll()

    expect(table.scrollLeft).toBe(510)
    expect(bar.scrollLeft).toBe(520)

    link.handleBarScroll()

    expect(table.scrollLeft).toBe(520)
    expect(tableScroll.writes).toEqual([510, 520])
    expect(barScroll.writes).toEqual([])
  })

  it('keeps a bar drag when a layout refresh lands between the bar and table scroll events', () => {
    const table = document.createElement('div')
    const bar = document.createElement('div')
    const tableScroll = scrollable(table)
    const barScroll = scrollable(bar)
    const link = createHorizontalScrollLink(table, bar, () => true)

    barScroll.userScroll(551)
    link.handleBarScroll()
    link.alignBar()
    barScroll.userScroll(560)
    link.handleTableScroll()
    link.handleBarScroll()

    expect(table.scrollLeft).toBe(560)
    expect(bar.scrollLeft).toBe(560)
    expect(barScroll.writes).toEqual([])
    expect(tableScroll.writes).toEqual([551, 560])
  })

  it('aligns a bar that becomes visible with the current table position', () => {
    const table = document.createElement('div')
    const bar = document.createElement('div')
    scrollable(table, 300)
    const barScroll = scrollable(bar)
    const link = createHorizontalScrollLink(table, bar, () => true)

    link.alignBar()
    link.handleBarScroll()

    expect(bar.scrollLeft).toBe(300)
    expect(barScroll.writes).toEqual([300])
  })

  it('does not let a hidden bar move the table', () => {
    const table = document.createElement('div')
    const bar = document.createElement('div')
    const tableScroll = scrollable(table, 300)
    const barScroll = scrollable(bar)
    let canBarDrive = false
    const link = createHorizontalScrollLink(table, bar, () => canBarDrive)

    barScroll.userScroll(0)
    link.handleBarScroll()

    expect(table.scrollLeft).toBe(300)

    canBarDrive = true
    barScroll.userScroll(150)
    link.handleBarScroll()

    expect(tableScroll.writes).toEqual([150])
  })
})

describe('vertical wheel forwarding', () => {
  it('converts line and page deltas to pixels', () => {
    expect(getWheelDeltaPixels({ deltaMode: 0, deltaY: 100 }, 500)).toBe(100)
    expect(getWheelDeltaPixels({ deltaMode: 1, deltaY: 3 }, 500)).toBe(48)
    expect(getWheelDeltaPixels({ deltaMode: 2, deltaY: -1 }, 500)).toBe(-500)
  })

  it('targets the table first and the page scroller once the table cannot move further', () => {
    const workspace = document.createElement('div')
    const frame = document.createElement('div')
    const table = document.createElement('div')

    frame.style.overflowY = 'hidden'
    workspace.append(frame)
    frame.append(table)
    document.body.append(workspace)
    verticalScroller(workspace, { clientHeight: 666, scrollHeight: 1037, scrollTop: 0 })
    verticalScroller(table, { clientHeight: 350, scrollHeight: 2011, scrollTop: 0 })

    expect(getVerticalWheelTarget(table, 100)).toBe(table)
    expect(getVerticalWheelTarget(table, -100)).toBeNull()

    table.scrollTop = 1661

    expect(getVerticalWheelTarget(table, 100)).toBe(workspace)
  })
})
