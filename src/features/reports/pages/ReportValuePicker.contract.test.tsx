import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportFilterRow } from './ReportFilterRow'
import { ReportValuePicker, type ReportValuePickerProps } from './ReportValuePicker'
import { REPORT_VALUE_SEARCH_DEBOUNCE_MS, REPORT_VALUE_VISIBLE_PILLS, reportValueExactId, useReportValueSearch } from './reportValueSearch'

const options = [
  { value: '1', label: 'AKKUS DOKUM [1]' },
  { value: '2', label: 'BENEFIT OTOMOTIV [2]' },
  { value: '3', label: 'CEVAHIR [3]' },
]
const events = { more: vi.fn(), retry: vi.fn(), added: vi.fn() }

function Shell({ children, portals }: { children: ReactNode; portals?: boolean }) {
  return <MantineProvider env={portals ? 'default' : 'test'}><I18nProvider>
    <div className="constructor-filters__table" data-testid="filters-table" style={{ overflowX: 'auto' }}>
      <ReportFilterRow label="Умова відбору 1" field={null} condition={null} value={children} toggle={null} action={null} />
    </div>
    <button type="button">Сформувати</button>
  </I18nProvider></MantineProvider>
}

type HarnessProps = Partial<ReportValuePickerProps> & { initial?: string[]; freeText?: boolean; portals?: boolean }
function Harness({ initial = [], freeText, portals, data = options, mode = 'multi', ...props }: HarnessProps) {
  const [keys, setKeys] = useState(initial)
  const [texts, setTexts] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const known = [...options, ...texts.map(text => ({ value: `text:${text}`, label: text }))]
  const selected = keys.map(key => known.find(item => item.value === key) ?? { value: key, label: `Збережене ${key}` })
  return <Shell portals={portals}>
    <ReportValuePicker label="Значення" mode={mode} data={data} selected={selected} search={search} onSearchChange={setSearch}
      onChange={setKeys} onLoadMore={events.more} onRetry={events.retry}
      onAddText={freeText ? text => { events.added(text); setTexts(current => [...current, text]); setKeys(current => [...current, `text:${text}`]) } : undefined}
      {...props} />
    <output data-testid="keys">{JSON.stringify(keys)}</output>
  </Shell>
}

const keys = () => JSON.parse(screen.getByTestId('keys').textContent!)
const box = () => screen.getByRole(screen.queryByRole('combobox') ? 'combobox' : 'textbox', { name: 'Значення' }) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('dropdown', () => {
  it.each(['multi', 'single'] as const)('renders the %s options in a portal outside the scrollable filter table', async mode => {
    render(<Harness mode={mode} portals />)
    await userEvent.click(box())
    const option = await screen.findByRole('option', { name: options[0].label })
    expect(screen.getByTestId('filters-table').contains(option)).toBe(false)
    expect(screen.getByRole('listbox', { name: 'Значення' })).toBeTruthy()
    expect(box().getAttribute('aria-expanded')).toBe('true')
  })

  it('shows a loading line instead of stale or empty results while a lookup is running', async () => {
    render(<Harness data={[]} loading />)
    await userEvent.click(box())
    expect(await screen.findByText('Завантаження…')).toBeTruthy()
    expect(screen.queryByText('Нічого не знайдено')).toBeNull()
  })

  it('filters a locally loaded directory by the typed text and leaves remote results untouched', async () => {
    const view = render(<Harness remote={false} />)
    await userEvent.type(box(), 'benefit')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([options[1].label])
    view.unmount()
    render(<Harness />)
    await userEvent.type(box(), 'benefit')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})

describe('choosing', () => {
  it('multi: mouse toggles values, keeps the list open and keeps the typed text', async () => {
    render(<Harness />)
    await userEvent.type(box(), 'a')
    await userEvent.click(screen.getByRole('option', { name: options[0].label }))
    await userEvent.click(screen.getByRole('option', { name: options[1].label }))
    expect(keys()).toEqual(['1', '2'])
    expect(box().value).toBe('a')
    await userEvent.click(screen.getByRole('option', { name: options[0].label }))
    expect(keys()).toEqual(['2'])
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('single: a choice replaces the value, closes the list and clears the typed text', async () => {
    render(<Harness mode="single" initial={['1']} />)
    await userEvent.type(box(), 'c')
    await userEvent.click(screen.getByRole('option', { name: options[2].label }))
    expect(keys()).toEqual(['3'])
    expect(box().value).toBe('')
    expect(screen.queryByRole('option')).toBeNull()
  })

  it.each(['multi', 'single'] as const)('%s: ArrowDown/ArrowUp/Enter choose exactly like the mouse', async mode => {
    render(<Harness mode={mode} />)
    await userEvent.type(box(), 'a')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')
    expect(keys()).toEqual(['1'])
  })

  it('Escape closes the list, keeps the typed text and creates no value', async () => {
    render(<Harness />)
    await userEvent.type(box(), 'нема такого')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('option')).toBeNull()
    expect(box().getAttribute('aria-expanded')).toBe('false')
    expect(box().value).toBe('нема такого')
    expect(keys()).toEqual([])
  })

  it.each(['multi', 'single'] as const)('%s: typed text that was not chosen is cleared on blur and never becomes a value', async mode => {
    render(<Harness mode={mode} />)
    await userEvent.type(box(), 'AKKUS')
    await userEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
    expect(box().value).toBe('')
    expect(keys()).toEqual([])
    expect(screen.queryByRole('option')).toBeNull()
  })
})

describe('selected values', () => {
  it.each(['multi', 'single'] as const)('%s: shows «Вибрано: N» with removable pills', async mode => {
    render(<Harness mode={mode} initial={['1', '2']} />)
    expect(screen.getByRole('button', { name: 'Вибрано: 2' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: `Видалити ${options[0].label}` }))
    expect(keys()).toEqual(['2'])
    expect(screen.getByRole('button', { name: 'Вибрано: 1' })).toBeTruthy()
  })

  it('caps the pills and lists every selected value behind «Вибрано: N»', async () => {
    const initial = Array.from({ length: REPORT_VALUE_VISIBLE_PILLS + 4 }, (_, index) => `saved-${index}`)
    render(<Harness initial={initial} data={[]} />)
    expect(screen.getAllByRole('button', { name: /^Видалити / })).toHaveLength(REPORT_VALUE_VISIBLE_PILLS)
    expect(screen.getByText('ще 4')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: `Вибрано: ${initial.length}` }))
    expect(screen.getAllByRole('option')).toHaveLength(initial.length)
    await userEvent.click(screen.getByRole('option', { name: 'Збережене saved-9' }))
    expect(keys()).toEqual(initial.slice(0, -1))
  })

  it('Backspace in an empty input removes the last value; with text it only edits the text', async () => {
    render(<Harness initial={['1', '2']} />)
    await userEvent.type(box(), 'x')
    await userEvent.keyboard('{Backspace}')
    expect(keys()).toEqual(['1', '2'])
    await userEvent.keyboard('{Backspace}')
    expect(keys()).toEqual(['1'])
  })

  it.each([['disabled', { disabled: true }], ['read-only', { readOnly: true }]] as const)('%s: the selection cannot be changed', async (_name, props) => {
    render(<Harness initial={['1', '2']} {...props} />)
    expect(screen.queryByRole('button', { name: /^Видалити / })).toBeNull()
    fireEvent.keyDown(box(), { key: 'Backspace' })
    fireEvent.focus(box())
    expect(screen.queryByRole('option')).toBeNull()
    expect(keys()).toEqual(['1', '2'])
    expect(props && 'disabled' in props ? box().disabled : box().readOnly).toBe(true)
  })
})

describe('paging and failures', () => {
  it('offers «Ще значення» at the end of the list for mouse and keyboard and keeps the typed text', async () => {
    render(<Harness hasMore />)
    await userEvent.type(box(), 'a')
    await userEvent.click(screen.getByRole('option', { name: 'Ще значення' }))
    expect(events.more).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(events.more).toHaveBeenCalledTimes(2)
    expect(box().value).toBe('a')
    expect(keys()).toEqual([])
  })

  it('does not offer the next page while it is loading', async () => {
    render(<Harness hasMore loadingMore />)
    await userEvent.click(box())
    await userEvent.click(screen.getByRole('option', { name: 'Ще значення' }))
    expect(events.more).not.toHaveBeenCalled()
  })

  it('shows a failed lookup as a visible error with a retry, never as a silent empty list', async () => {
    render(<Harness data={[]} lookupError="Не вдалося завантажити значення." />)
    expect(screen.getByRole('alert').textContent).toBe('Не вдалося завантажити значення.')
    await userEvent.click(box())
    expect(screen.queryByText('Нічого не знайдено')).toBeNull()
    await userEvent.click(screen.getByRole('option', { name: 'Спробувати ще раз' }))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(events.retry).toHaveBeenCalledTimes(2)
  })

  it('keeps already loaded options when only the next page failed', async () => {
    render(<Harness lookupError="Не вдалося завантажити значення." />)
    await userEvent.click(box())
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([...options.map(option => option.label), 'Спробувати ще раз'])
  })
})

describe('free-text fields', () => {
  it('adds the typed text with Enter or «Додати», says so in the placeholder and has no dropdown', async () => {
    render(<Harness freeText data={[]} />)
    expect(box().placeholder).toBe('Введіть значення і натисніть Enter')
    await userEvent.type(box(), ' 4711 {Enter}')
    await userEvent.type(box(), 'A-15')
    expect(screen.queryByRole('option')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Додати' }))
    expect(events.added.mock.calls).toEqual([['4711'], ['A-15']])
    expect(box().value).toBe('')
    expect(screen.getByRole('button', { name: 'Видалити 4711' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Вибрано: 2' })).toBeTruthy()
  })

  it('does not turn text into a value on blur', async () => {
    render(<Harness freeText data={[]} />)
    await userEvent.type(box(), '4711')
    await userEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
    expect(events.added).not.toHaveBeenCalled()
    expect(box().value).toBe('')
  })
})

describe('search', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces every lookup by one shared delay and the last text wins', () => {
    expect(REPORT_VALUE_SEARCH_DEBOUNCE_MS).toBe(300)
    const hook = renderHook(() => useReportValueSearch())
    act(() => hook.result.current.setSearch('a'))
    act(() => { vi.advanceTimersByTime(REPORT_VALUE_SEARCH_DEBOUNCE_MS - 1) })
    act(() => hook.result.current.setSearch('ak'))
    expect(hook.result.current).toMatchObject({ search: 'ak', query: '', pending: true })
    act(() => { vi.advanceTimersByTime(REPORT_VALUE_SEARCH_DEBOUNCE_MS - 1) })
    expect(hook.result.current.query).toBe('')
    act(() => { vi.advanceTimersByTime(1) })
    expect(hook.result.current).toMatchObject({ search: 'ak', query: 'ak', pending: false })
  })

  it('reads the exact-ID token the same way for every field that has numeric IDs', () => {
    expect(reportValueExactId('id:123')).toBe('123')
    expect(reportValueExactId('id:')).toBe('')
    expect(reportValueExactId('ID 123')).toBeNull()
    expect(reportValueExactId('123')).toBeNull()
  })
})
