import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'

type MovementRow = {
  client: string
  number: string
}

const geometry = {
  nativeScrollbarHeight: 18,
  maxScrollLeft: 809,
  scrollClientWidth: 1081,
  scrollHeight: 360,
  scrollTop: 835,
  scrollWidth: 1900,
}
const scrollLefts = new WeakMap<Element, number>()
const frames: FrameRequestCallback[] = []
const originalViewport = { height: window.innerHeight, width: window.innerWidth }

function rect(left: number, top: number, width: number, height: number) {
  return new DOMRect(left, top, width, height)
}

function stubGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('data-table-scroll')) {
      return rect(292, geometry.scrollTop, 1101, geometry.scrollHeight)
    }

    if (this.classList.contains('test-frame')) {
      return rect(292, geometry.scrollTop, 1101, geometry.scrollHeight)
    }

    if (this.classList.contains('test-workspace')) {
      return rect(268, 195, 1172, 666)
    }

    if (this.classList.contains('data-table-sticky-scrollbar')) {
      return rect(Number.parseFloat(this.style.left) || 0, Number.parseFloat(this.style.top) || 0, 0, 0)
    }

    return rect(0, 0, 0, 0)
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('data-table-scroll')) {
      return geometry.scrollClientWidth
    }

    if (this.classList.contains('test-frame')) return 1101

    return this.classList.contains('test-workspace') ? 1157 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('data-table-scroll')) {
      return geometry.scrollHeight - geometry.nativeScrollbarHeight
    }

    if (this.classList.contains('test-frame')) return geometry.scrollHeight

    return this.classList.contains('test-workspace') ? 666 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('data-table-scroll') ? geometry.scrollHeight : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('data-table-scroll') ? geometry.scrollWidth : 0
  })
  vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockImplementation(function (this: Element) {
    return scrollLefts.get(this) ?? 0
  })
  vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(function (this: Element, value: number) {
    const max = this.classList.contains('data-table-scroll') ? geometry.maxScrollLeft : Number.POSITIVE_INFINITY

    scrollLefts.set(this, Math.min(Math.max(0, value), max))
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('test-workspace') ? 1037 : 0
  })
}

function trackScrollTop(element: HTMLElement) {
  let value = 0

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      value = next
    },
  })
}

function flushFrames() {
  act(() => {
    frames.splice(0).forEach((callback) => callback(0))
  })
}

function renderMovementTable(stickyHorizontalScrollbar = true) {
  const view = render(
    <MantineProvider>
      <I18nProvider>
        <div className="test-workspace" style={{ overflowY: 'auto' }}>
          <div className="test-frame" style={{ overflow: 'hidden' }}>
            <DataTable<MovementRow>
              columns={[
                { id: 'number', header: 'Номер', width: 900, accessor: (row) => row.number },
                { id: 'client', header: 'Клієнт', width: 1000, accessor: (row) => row.client },
              ]}
              data={[{ client: 'ТОВ «Тест»', number: 'CH0000001' }]}
              getRowId={(row) => row.number}
              maxHeight={360}
              minWidth={1900}
              showLayoutControls={false}
              stickyHorizontalScrollbar={stickyHorizontalScrollbar}
              tableId="sticky-scrollbar-test"
            />
          </div>
        </div>
      </I18nProvider>
    </MantineProvider>,
  )
  flushFrames()

  const scroll = view.container.querySelector<HTMLElement>('.data-table-scroll')!
  const bar = view.container.querySelector<HTMLElement>('.data-table-sticky-scrollbar')
  const workspace = view.container.querySelector<HTMLElement>('.test-workspace')!

  return { bar, scroll, workspace, unmount: view.unmount }
}

beforeEach(() => {
  geometry.nativeScrollbarHeight = 18
  geometry.maxScrollLeft = 809
  geometry.scrollHeight = 360
  geometry.scrollClientWidth = 1081
  geometry.scrollTop = 835
  geometry.scrollWidth = 1900
  frames.length = 0
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  stubGeometry()
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalViewport.height })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalViewport.width })
})

describe('DataTable sticky horizontal scrollbar', () => {
  it('is not rendered for tables that do not opt in', () => {
    const { bar } = renderMovementTable(false)

    expect(bar).toBeNull()
  })

  it('pins a bar with the table scroll box width to the bottom of the visible area', () => {
    const { bar } = renderMovementTable()

    expect(bar?.dataset.visible).toBe('true')
    expect(bar?.getAttribute('aria-label')).toBe('Горизонтальна прокрутка таблиці')
    expect(bar?.tabIndex).toBe(0)
    expect(bar?.style.left).toBe('292px')
    expect(bar?.style.top).toBe('843px')
    expect(bar?.style.width).toBe('1101px')
    expect(bar?.style.height).toBe('18px')
    expect((bar?.firstElementChild as HTMLElement).style.width).toBe('1910px')
  })

  it('keeps the bar and the table horizontally in sync both ways', () => {
    const { bar, scroll } = renderMovementTable()

    bar!.scrollLeft = 400
    fireEvent.scroll(bar!)
    expect(scroll.scrollLeft).toBe(400)

    scroll.scrollLeft = 120
    fireEvent.scroll(scroll)
    expect(bar!.scrollLeft).toBe(120)

    bar!.scrollLeft = 1000
    fireEvent.scroll(bar!)
    expect(scroll.scrollLeft).toBe(809)
    fireEvent.scroll(scroll)
    expect(bar!.scrollLeft).toBe(809)
  })

  it('reaches both ends with the keyboard without switching products', () => {
    const { bar, scroll } = renderMovementTable()
    const productNavigation = vi.fn()
    document.addEventListener('keydown', productNavigation)

    fireEvent.keyDown(bar!, { key: 'End' })
    expect(scroll.scrollLeft).toBe(809)
    expect(bar!.scrollLeft).toBe(809)
    fireEvent.keyDown(bar!, { key: 'ArrowLeft' })
    expect(scroll.scrollLeft).toBe(769)
    fireEvent.keyDown(bar!, { key: 'Home' })
    expect(scroll.scrollLeft).toBe(0)
    expect(bar!.scrollLeft).toBe(0)
    fireEvent.keyDown(bar!, { key: 'ArrowRight' })
    expect(scroll.scrollLeft).toBe(40)
    document.removeEventListener('keydown', productNavigation)
    expect(productNavigation).not.toHaveBeenCalled()
  })

  it('re-measures the reachable range after the columns change without moving the table', () => {
    const { bar, scroll } = renderMovementTable()

    scroll.scrollLeft = 300
    fireEvent.scroll(scroll)
    geometry.scrollWidth = 2100
    geometry.maxScrollLeft = 1009
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    flushFrames()

    expect(scroll.scrollLeft).toBe(300)
    expect(bar!.scrollLeft).toBe(300)
    expect((bar!.firstElementChild as HTMLElement).style.width).toBe('2110px')
  })

  it('keeps the control at the table bottom when the native scrollbar is visible', () => {
    const { bar, workspace } = renderMovementTable()

    geometry.scrollTop = 478
    fireEvent.scroll(workspace)
    flushFrames()
    expect(bar?.dataset.visible).toBe('true')
    expect(bar?.style.top).toBe('820px')

    geometry.scrollTop = 600
    fireEvent.scroll(workspace)
    flushFrames()
    expect(bar?.dataset.visible).toBe('true')
  })

  it('keeps a one-row table control visible inside the product frame', () => {
    geometry.scrollTop = 715
    geometry.scrollHeight = 89

    const { bar, scroll } = renderMovementTable()

    expect(scroll.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(bar?.dataset.visible).toBe('true')
    expect(bar?.style.top).toBe('786px')
  })

  it('reserves space below the last row for macOS overlay scrollbars', () => {
    geometry.nativeScrollbarHeight = 0
    geometry.scrollTop = 715
    geometry.scrollHeight = 89
    const { bar, scroll, unmount } = renderMovementTable()

    expect(bar?.dataset.visible).toBe('true')
    expect(bar?.style.height).toBe('18px')
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('18px')

    // Once every column fits, neither the fixed control nor its space remains.
    geometry.scrollClientWidth = geometry.scrollWidth
    fireEvent(window, new Event('resize'))
    flushFrames()
    expect(bar?.dataset.visible).toBe('false')
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('0px')

    unmount()
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('')
  })

  it('does not add a second gutter when the native scrollbar already reserves space', () => {
    const { scroll } = renderMovementTable()
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('0px')

    geometry.nativeScrollbarHeight = 0
    fireEvent(window, new Event('resize'))
    flushFrames()
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('18px')

    geometry.nativeScrollbarHeight = 18
    fireEvent(window, new Event('resize'))
    flushFrames()
    expect(scroll.style.getPropertyValue('--data-table-sticky-scrollbar-inset')).toBe('0px')
  })

  it('hides while the table is fully below the visible area', () => {
    const { bar, workspace } = renderMovementTable()

    geometry.scrollTop = 900
    fireEvent.scroll(workspace)
    flushFrames()

    expect(bar?.dataset.visible).toBe('false')
  })

  it('hides when every column fits without horizontal scrolling', () => {
    const { bar } = renderMovementTable()

    geometry.scrollClientWidth = 1900
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    flushFrames()

    expect(bar?.dataset.visible).toBe('false')
  })

  it('keeps vertical wheel scrolling working over the bar', () => {
    const { bar, workspace } = renderMovementTable()

    trackScrollTop(workspace)

    const notCancelled = fireEvent.wheel(bar!, { deltaMode: 0, deltaX: 0, deltaY: 120 })

    expect(notCancelled).toBe(false)
    expect(workspace.scrollTop).toBe(120)
  })

  it('leaves horizontal wheel gestures to the bar itself', () => {
    const { bar, workspace } = renderMovementTable()

    trackScrollTop(workspace)

    const notCancelled = fireEvent.wheel(bar!, { deltaMode: 0, deltaX: 120, deltaY: 10 })

    expect(notCancelled).toBe(true)
    expect(workspace.scrollTop).toBe(0)
  })
})
