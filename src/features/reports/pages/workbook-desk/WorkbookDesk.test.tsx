import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WorkbookActionBar } from './WorkbookActionBar'
import { WorkbookResult } from './WorkbookResult'
import { WorkbookSettings } from './WorkbookSettings'

const wrap = (children: ReactNode) => <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
const bar = (props: Partial<Parameters<typeof WorkbookActionBar>[0]> = {}) => wrap(<WorkbookActionBar canSubmit isLoading={false}
  blockedReason={null} ran={false} excelUrl={null} pdfUrl={null} fileBaseName="ВП 01.09.2026-30.09.2026" resetDisabled={false}
  onPreview={vi.fn()} onGenerate={vi.fn()} onReset={vi.fn()} {...props} />)
const result = (props: Partial<Parameters<typeof WorkbookResult>[0]> = {}) => wrap(<WorkbookResult dataSource={35} title="Валовий прибуток"
  period="01.09.2026 – 30.09.2026" isLoading={false} error={null} emptyRun={null} stale={false} generated={false} table={null}
  excelUrl={null} pdfUrl={null} fileBaseName={null} {...props} />)

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(() => { vi.useRealTimers() })

it('forms the files before a run and downloads them directly once the run has them', () => {
  const onGenerate = vi.fn()
  const view = render(bar({ onGenerate }))
  expect((screen.getByRole('button', { name: 'Сформувати Excel' }) as HTMLButtonElement).type).toBe('submit')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати PDF' }))
  expect(onGenerate).toHaveBeenCalledOnce()
  view.rerender(bar({ ran: true, excelUrl: '/Data/a.xlsx', pdfUrl: '/Data/a.pdf' }))
  expect(screen.getByRole('link', { name: 'Завантажити Excel' }).getAttribute('download')).toBe('ВП 01.09.2026-30.09.2026.xlsx')
  expect(screen.getByRole('link', { name: 'Завантажити PDF' }).getAttribute('download')).toBe('ВП 01.09.2026-30.09.2026.pdf')
  expect(screen.getByText('Файли готові — натисніть «Excel» або «PDF», щоб завантажити.')).toBeTruthy()
})

it('says which file the server did not return and does not offer to form it again', () => {
  render(bar({ ran: true, excelUrl: '/Data/a.xlsx' }))
  const pdf = screen.getByRole('button', { name: 'Сформувати PDF' }) as HTMLButtonElement
  expect(pdf.disabled).toBe(true)
  expect(pdf.title).toBe('Сервер не повернув файл PDF для цього звіту.')
  expect(screen.getByText('Готовий лише файл Excel: сервер не повернув PDF.')).toBeTruthy()
})

it('names the blocking reason once and only while the actions are blocked', () => {
  const view = render(bar({ canSubmit: false, blockedReason: 'Виберіть хоча б один показник' }))
  expect(document.getElementById('report-constructor-blocked-reason')?.textContent).toBe('Виберіть хоча б один показник')
  view.rerender(bar({ canSubmit: false, isLoading: true, blockedReason: 'Виберіть хоча б один показник' }))
  expect(document.getElementById('report-constructor-blocked-reason')).toBeNull()
  expect(screen.getByText('Звіт формується…')).toBeTruthy()
  view.rerender(bar())
  expect(document.getElementById('report-constructor-blocked-reason')).toBeNull()
})

it('walks through the run stages by time and says when the run takes longer than usual', () => {
  vi.useFakeTimers()
  render(result({ isLoading: true }))
  const status = () => screen.getByText(/^(Зараз|Довше)/).textContent
  expect(status()).toBe('Зараз: надсилаємо запит на сервер звітів.')
  act(() => { vi.advanceTimersByTime(5000) })
  expect(status()).toBe('Зараз: сервер читає документи за період.')
  expect(screen.getByText('5 с')).toBeTruthy()
  act(() => { vi.advanceTimersByTime(10000) })
  expect(status()).toBe('Зараз: рахуємо суми й підсумки.')
  act(() => { vi.advanceTimersByTime(11000) })
  expect(status()).toBe('Довше, ніж зазвичай: сервер ще працює. Зачекайте — сторінку не закривайте.')
  expect(screen.getByRole('region', { name: 'Результат' }).getAttribute('aria-busy')).toBe('true')
})

it('tells the states of the result apart in words', () => {
  const view = render(result())
  expect(screen.getByText('Таблиці ще немає')).toBeTruthy()
  expect(screen.getByText(/Зазвичай це займає 15–25 с\./)).toBeTruthy()
  view.rerender(result({ stale: true }))
  expect(screen.getByText('Налаштування змінено')).toBeTruthy()
  view.rerender(result({ generated: true }))
  expect(screen.getByText('Файли сформовано')).toBeTruthy()
  view.rerender(result({ emptyRun: 'За період 01.09.2026 – 30.09.2026 сервер не повернув файл звіту.' }))
  expect(screen.getByText('Файл звіту не сформовано')).toBeTruthy()
  view.rerender(result({ error: 'Сервер звітів недоступний. Спробуйте ще раз пізніше.' }))
  const alert = screen.getByRole('alert')
  expect(within(alert).getByText('Звіт не сформовано')).toBeTruthy()
  expect(within(alert).getByText(/Натисніть «Показати на екрані» ще раз/)).toBeTruthy()
  view.rerender(result({ table: <table aria-label="Таблиця" />, excelUrl: '/Data/a.xlsx', pdfUrl: '/Data/a.pdf', fileBaseName: 'ВП' }))
  expect(screen.getByRole('table', { name: 'Таблиця' })).toBeTruthy()
  expect(screen.getByText('Усі рядки та підсумки — у файлах:')).toBeTruthy()
})

it('keeps the period open, folds the other sections behind a summary and opens them at the chosen one', () => {
  render(wrap(<WorkbookSettings period={<input aria-label="Від" />} advanced={<p>Джерело</p>} sections={[
    { id: 'filters', title: 'Відбори', summary: 'Товари без послуг', content: <label>Група «Покупці»<input type="checkbox" /></label> },
    { id: 'measures', title: 'Показники', summary: '10 показників', content: <p>Таблиця показників</p> },
  ]} />))
  expect(screen.getByRole('textbox', { name: 'Від' })).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: 'Група «Покупці»' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Показники: 10 показників' }))
  expect(screen.getByRole('button', { name: 'Згорнути налаштування' }).getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('checkbox', { name: 'Група «Покупці»' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Відбори' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Згорнути налаштування' }))
  expect(screen.queryByRole('checkbox', { name: 'Група «Покупці»' })).toBeNull()
})
