import { MantineProvider } from '@mantine/core'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConstructorGroupingPanels } from './ConstructorGrouping'
import { ConstructorMeasures } from './ConstructorMeasures'
import { ConstructorFilters } from './ConstructorFilters'
import { ConstructorDesk, type ConstructorDeskActions } from './ConstructorDesk'
import { reorderReportGrouping, transferReportGrouping, type ReportGroupingAxis, type ReportGroupingLayout } from '../../data/reportGroupingLayout'
import type { ConstructorField } from '../../data/constructorDesk'
import type { ReportMeasurementGroup } from '../../types'

afterEach(cleanup)

const wrap = (node: React.ReactNode) => render(<MantineProvider env="test"><I18nProvider>{node}</I18nProvider></MantineProvider>)
const item = (type: number, label: string) => ({ type, key: String(type), label })

function GroupingHarness({ onAdd }: { onAdd: (axis: ReportGroupingAxis, types: number[]) => void }) {
  const [layout, setLayout] = useState<ReportGroupingLayout>({ Row: [item(4, 'Організація'), item(10, 'Група товару'), item(84, 'Детальний запис GBA')], Col: [item(2, 'По місяцях')] })
  const allowed = new Set([2, 4, 10, 12, 21, 84])
  const fields: ConstructorField[] = [{ type: 12, label: 'Назва', path: ['Покупець'] }, { type: 21, label: 'Постачальник', path: [] }]
  return <ConstructorGroupingPanels layout={layout} allowed={allowed} locked={new Set([84])} rowsOnly={false} measures={<p>Показники</p>}
    caption={group => group.label} available={() => fields}
    onAdd={(axis, types) => { onAdd(axis, types); setLayout(current => ({ ...current, [axis]: [...current[axis], ...types.map(type => item(type, String(type)))] })) }}
    onRemove={(axis, index) => setLayout(current => ({ ...current, [axis]: current[axis].filter((_, position) => position !== index) }))}
    onReorder={(axis, type, direction) => setLayout(current => ({ ...current, [axis]: reorderReportGrouping(current[axis], type, direction, allowed) }))}
    onTransfer={(axis, type) => setLayout(current => transferReportGrouping(current, axis, type, allowed))} />
}

it('selects, reorders, deletes and moves groupings between rows and columns with the panel toolbars', () => {
  const onAdd = vi.fn()
  wrap(<GroupingHarness onAdd={onAdd} />)
  const rows = screen.getByRole('region', { name: 'Групування рядків' })
  const columns = screen.getByRole('region', { name: 'Групування колонок' })
  expect(within(rows).getByRole('button', { name: 'Видалити вибране поле' })).toHaveProperty('disabled', true)
  fireEvent.click(within(rows).getByRole('button', { name: 'Група товару' }))
  fireEvent.click(within(rows).getByRole('button', { name: 'Перемістити Група товару вище' }))
  expect(within(rows).getAllByRole('listitem').map(node => node.textContent)).toEqual(['Група товаруЕлементи', 'ОрганізаціяЕлементи', 'Детальний запис GBAЕлементи'])
  expect(within(rows).getByRole('button', { name: 'Перемістити Група товару вище' })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Перенести Група товару до колонок' }))
  expect(within(columns).getAllByRole('listitem').map(node => node.textContent)).toEqual(['По місяцяхЕлементи', 'Група товаруЕлементи'])
  fireEvent.click(screen.getByRole('button', { name: 'Перенести Група товару до рядків' }))
  expect(within(rows).getAllByRole('listitem').map(node => node.textContent)).toEqual(['ОрганізаціяЕлементи', 'Група товаруЕлементи', 'Детальний запис GBAЕлементи'])
  fireEvent.click(within(rows).getByRole('button', { name: 'Детальний запис GBA (закріплено)' }))
  expect(within(rows).getByRole('button', { name: 'Видалити Детальний запис GBA' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Перенести Детальний запис GBA до колонок' })).toHaveProperty('disabled', true)
  fireEvent.click(within(rows).getByRole('button', { name: 'Організація' }))
  fireEvent.click(within(rows).getByRole('button', { name: 'Видалити Організація' }))
  expect(within(rows).queryByRole('button', { name: 'Організація' })).toBeNull()
  fireEvent.change(within(rows).getByRole('textbox', { name: 'Пошук: Групування рядків' }), { target: { value: 'груп' } })
  expect(within(rows).getAllByRole('listitem').map(node => node.textContent)).toEqual(['Група товаруЕлементи'])
})

it('warns under the column grouping only when a very wide field is grouped by columns', () => {
  const panels = (layout: ReportGroupingLayout) => <ConstructorGroupingPanels layout={layout} allowed={new Set([2, 5])} locked={new Set()} rowsOnly={false}
    measures={null} caption={group => group.label} available={() => []} onAdd={vi.fn()} onRemove={vi.fn()} onReorder={vi.fn()} onTransfer={vi.fn()} />
  const view = wrap(panels({ Row: [item(5, 'Товар')], Col: [item(2, 'По місяцях')] }))
  expect(screen.queryByTestId('column-grouping-limit-hint')).toBeNull()
  view.rerender(<MantineProvider env="test"><I18nProvider>{panels({ Row: [item(2, 'По місяцях')], Col: [item(5, 'Товар')] })}</I18nProvider></MantineProvider>)
  expect(screen.getByTestId('column-grouping-limit-hint').textContent)
    .toBe('Групування колонок за полем «Товар» може перевищити ліміт 16\u00a0000 колонок. Перенесіть його в рядки або додайте відбір.')
  expect(within(screen.getByRole('region', { name: 'Групування рядків' })).queryByTestId('column-grouping-limit-hint')).toBeNull()
})

it('adds several fields from the searchable category tree of the add-field dialog', () => {
  const onAdd = vi.fn()
  wrap(<GroupingHarness onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування колонок' }))
  const dialog = screen.getByRole('dialog', { name: 'Додати поле для групування колонок' })
  expect(within(dialog).getByRole('button', { name: 'Додати вибрані' })).toHaveProperty('disabled', true)
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Вибрати всі поля: Покупець' }))
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Вибрати Постачальник' }))
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Пошук поля' }), { target: { value: 'покуп' } })
  expect(within(dialog).queryByRole('checkbox', { name: 'Вибрати Постачальник' })).toBeNull()
  expect(within(dialog).getByRole('checkbox', { name: 'Вибрати Назва' })).toHaveProperty('checked', true)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Додати вибрані' }))
  expect(onAdd).toHaveBeenCalledWith('Col', [12, 21])
  expect(screen.queryByRole('dialog')).toBeNull()
})

const measures = (): ReportMeasurementGroup[] => [
  { Name: 'SalesQuantity', IsChecked: true, SubList: [{ Name: 'SalesQuantity', Type: 0, IsChecked: true }] },
  { Name: 'SalesValue', IsChecked: false, SubList: [{ Name: 'SalesValueWithoutVAT', Type: 2, IsChecked: true }, { Name: 'SalesValueVAT', Type: 3, IsChecked: false }] },
  { Name: 'Cost', IsChecked: false, SubList: [{ Name: 'CostWithoutVAT', Type: 6, IsChecked: false }] },
]
const captions = {
  groupLabel: (group: ReportMeasurementGroup) => ({ SalesQuantity: 'Кількість продажу', SalesValue: 'Вартість продажу', Cost: 'Собівартість' })[group.Name]!,
  itemLabel: (group: ReportMeasurementGroup, measure: { Type: number }) => group.SubList.length === 1 ? captions.groupLabel(group) : measure.Type === 2 ? 'без ПДВ' : 'ПДВ',
  itemAccessibleLabel: (group: ReportMeasurementGroup, measure: { Type: number }) => group.SubList.length === 1 ? captions.groupLabel(group) : `${captions.groupLabel(group)}, ${measure.Type === 2 ? 'без ПДВ' : 'ПДВ'}`,
}

function MeasuresHarness({ onChange }: { onChange: (groups: ReportMeasurementGroup[]) => void }) {
  const [groups, setGroups] = useState(measures)
  return <ConstructorMeasures groups={groups} {...captions} onChange={next => { onChange(next); setGroups(next) }} />
}

it('checks, orders and sorts measures from the toolbar while keeping their types', () => {
  const onChange = vi.fn()
  wrap(<MeasuresHarness onChange={onChange} />)
  expect(screen.getByRole('checkbox', { name: 'Вартість продажу' })).toHaveProperty('indeterminate', true)
  fireEvent.click(screen.getByRole('button', { name: 'Вартість продажу, ПДВ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Вартість продажу, ПДВ вище' }))
  expect(onChange.mock.lastCall![0][1].SubList.map((entry: { Type: number }) => entry.Type)).toEqual([3, 2])
  fireEvent.click(screen.getByRole('button', { name: 'Собівартість' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Собівартість вище' }))
  expect(onChange.mock.lastCall![0].map((group: ReportMeasurementGroup) => group.Name)).toEqual(['SalesQuantity', 'Cost', 'SalesValue'])
  fireEvent.click(screen.getByRole('button', { name: 'Упорядкувати всі показники від А до Я' }))
  expect(onChange.mock.lastCall![0].map((group: ReportMeasurementGroup) => group.Name)).toEqual(['SalesValue', 'SalesQuantity', 'Cost'])
  fireEvent.click(screen.getByRole('button', { name: 'Вибрати всі показники' }))
  expect(onChange.mock.lastCall![0].every((group: ReportMeasurementGroup) => group.SubList.every(entry => entry.IsChecked))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Очистити вибір показників' }))
  expect(onChange.mock.lastCall![0].some((group: ReportMeasurementGroup) => group.SubList.some(entry => entry.IsChecked))).toBe(false)
  fireEvent.change(screen.getByRole('textbox', { name: 'Пошук показника' }), { target: { value: 'собів' } })
  expect(screen.queryByRole('checkbox', { name: 'Кількість продажу' })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Собівартість' })).toBeTruthy()
})

function FiltersHarness({ onCopy }: { onCopy: (index: number) => void }) {
  const [rows, setRows] = useState(['a', 'b'])
  return <ConstructorFilters count={rows.length} rowKeys={rows} footer={<p>Додатковий відбір</p>}
    renderRow={({ index, selected, onSelect }) => <div role="group" aria-label={`Умова відбору ${index + 1}`} data-selected={selected}>
      <button type="button" onClick={onSelect}>Поле {index + 1}</button></div>}
    onAdd={() => setRows(current => [...current, `n${current.length}`])}
    onDelete={index => setRows(current => current.filter((_, position) => position !== index))}
    onCopy={index => { onCopy(index); setRows(current => [...current, `${current[index]}-copy`]) }} />
}

it('adds, selects, copies and deletes selection rows from the filter toolbar', () => {
  const onCopy = vi.fn()
  wrap(<FiltersHarness onCopy={onCopy} />)
  expect(screen.getByRole('button', { name: 'Видалити вибраний відбір' })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  expect(screen.getAllByRole('group', { name: /Умова відбору/ })).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Поле 2' }))
  expect(screen.getByRole('group', { name: 'Умова відбору 2' }).getAttribute('data-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Копіювати вибраний відбір' }))
  expect(onCopy).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: 'Видалити вибраний відбір' }))
  expect(screen.getAllByRole('group', { name: /Умова відбору/ })).toHaveLength(3)
  expect(screen.getByText('Додатковий відбір')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Згорнути відбори' }))
  expect(screen.queryByRole('group', { name: /Умова відбору/ })).toBeNull()
})

const actions = (overrides: Partial<ConstructorDeskActions> = {}): ConstructorDeskActions => ({
  canSubmit: true, canExport: true, isLoading: false, blockedReason: null, ran: false, previewNeedsExport: false, excelUrl: null, pdfUrl: null,
  fileBaseName: null, pending: false, resetDisabled: false, onPreview: vi.fn(), onGenerate: vi.fn(), onReset: vi.fn(), onCancel: vi.fn(),
  onSaveTemplate: vi.fn(), onLoadTemplate: vi.fn(), ...overrides,
})

it('lays out the header, period, parameters, panels, filters and footer in the requested order', () => {
  const desk = actions()
  const onPeriod = vi.fn()
  wrap(<ConstructorDesk title="Звіт по продажам" templateName="" resolving={false} warning={null} disabled={false}
    period={{ from: '2026-10-01', to: '2026-10-31', minDate: '2000-01-01', maxDate: '2026-12-31', error: null, disabled: false, onChange: onPeriod }}
    parameters={<span>Параметр</span>} panels={<span>Панелі</span>} filters={<span>Відбори</span>} extras={<span>Формат чисел</span>} actions={desk} />)
  const region = screen.getByRole('region', { name: 'Звіт по продажам' })
  expect(within(region).getByRole('heading', { name: 'Звіт по продажам' })).toBeTruthy()
  const order = [...region.querySelectorAll('h2, button, [role="group"], section')].map(node => node.getAttribute('aria-label') ?? node.textContent)
  expect(order.indexOf('Зберегти шаблон')).toBeLessThan(order.indexOf('Завантажити шаблон'))
  expect(order.indexOf('Період')).toBeLessThan(order.indexOf('Параметри показників'))
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-10-20' } })
  expect(onPeriod).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-20' })
  const generate = screen.getAllByRole('button', { name: 'Сформувати' })
  expect(generate).toHaveLength(2)
  fireEvent.click(generate[1])
  expect(desk.onPreview).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити шаблон' }))
  expect(desk.onLoadTemplate).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти шаблон' }))
  expect(desk.onSaveTemplate).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати Excel' }))
  expect(desk.onGenerate).toHaveBeenCalledOnce()
  expect(screen.queryByRole('region', { name: 'Додаткові налаштування' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Додаткові налаштування' }))
  expect(screen.getByRole('region', { name: 'Додаткові налаштування' }).textContent).toBe('Формат чисел')
  fireEvent.click(screen.getByRole('button', { name: 'Згорнути параметри показників' }))
  expect(screen.getByText('Параметр').closest('[hidden]')).not.toBeNull()
})

it('blocks generation with the server reason and offers downloads once files exist', () => {
  wrap(<ConstructorDesk title="Валовий прибуток" templateName="Мій" resolving={false} warning="Увага" disabled={false} period={null}
    currentStateNotice={<span>Поточний стан</span>} parameters={null} panels={null} filters={null} extras={null}
    actions={actions({ canSubmit: false, blockedReason: 'Додайте хоча б одне групування рядків', excelUrl: '/files/a.xlsx', fileBaseName: 'Валовий' })} />)
  expect(screen.getAllByRole('button', { name: 'Сформувати' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
  expect(screen.getByText('Додайте хоча б одне групування рядків')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Завантажити Excel' }).getAttribute('download')).toBe('Валовий.xlsx')
  expect(screen.getByText('Шаблон «Мій»')).toBeTruthy()
  expect(screen.getByText('Поточний стан')).toBeTruthy()
})
