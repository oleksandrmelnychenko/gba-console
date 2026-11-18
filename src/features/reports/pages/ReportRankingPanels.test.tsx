import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReportDataset, ReportRequestBody } from '../types'
import { abcDataset, abcRequest } from '../data/reportAbcClassification.test-fixtures'
import { topDataset, topRequest } from '../data/reportTopGroups.test-fixtures'
import { ReportAbcClassificationPanel } from './ReportAbcClassificationPanel'
import { ReportTopGroupsPanel } from './ReportTopGroupsPanel'

const cases = [
  { name: 'TOP', Component: ReportTopGroupsPanel, dataset: topDataset, enable: 'Увімкнути TOP цілих груп',
    disable: 'Вимкнути TOP: залишити всі групи' },
  { name: 'ABC', Component: ReportAbcClassificationPanel, dataset: abcDataset, enable: 'Увімкнути ABC-класифікацію',
    disable: 'Вимкнути ABC-класифікацію' },
] as const

function inactiveRequest(): ReportRequestBody {
  const data: ReportRequestBody = topRequest()
  delete data.topGroups
  return data
}

describe.each(cases)('$name panel prerequisites and explicit actions', ({ name, Component, dataset, enable, disable }) => {
  function show(data = inactiveRequest(), source: ReportDataset | undefined = dataset, disabled = false) {
    const onChange = vi.fn(), onConfigureGrouping = vi.fn(), onConfigureMeasures = vi.fn()
    const view = render(<MantineProvider env="test"><Component data={data} dataset={source} disabled={disabled}
      onChange={onChange} onConfigureGrouping={onConfigureGrouping} onConfigureMeasures={onConfigureMeasures} /></MantineProvider>)
    return { ...view, onChange, onConfigureGrouping, onConfigureMeasures }
  }

  function expectNoCaption(button?: HTMLButtonElement) {
    expect(screen.queryByText(/додайте до рядків|увімкніть показник|не підтвердив|Редагування недоступне/)).toBeNull()
    expect(button?.getAttribute('aria-describedby') ?? null).toBeNull()
  }

  it('hides an unsupported or unverified dataset without a caption or an unsafe enable action', () => {
    const source = structuredClone(dataset)
    if (name === 'TOP') source.TopGroups = { Version: 99 }
    else source.AbcClassification = { Version: 99 }
    const data = inactiveRequest(), original = structuredClone(data), { onChange } = show(data, source)
    expectNoCaption()
    expect(screen.queryByRole('button', { name: enable })).toBeNull()
    expect(screen.queryByRole('button', { name: `Налаштувати групування для ${name}` })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(data).toEqual(original)
  })

  it('offers only grouping navigation when the row field is missing even if it is selected in columns', () => {
    const data = inactiveRequest()
    data.sorted.Col = data.sorted.Row
    data.sorted.Row = []
    const original = structuredClone(data), { onChange, onConfigureGrouping, onConfigureMeasures } = show(data)
    const button = screen.getByRole('button', { name: enable }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expectNoCaption(button)
    expect(screen.queryByRole('button', { name: `Налаштувати показники для ${name}` })).toBeNull()
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: `Налаштувати групування для ${name}` }))
    expect(onConfigureGrouping).toHaveBeenCalledOnce()
    expect(onConfigureMeasures).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(data).toEqual(original)
  })

  it('offers only measure navigation when no additive measure is enabled and navigates on request', () => {
    const data = inactiveRequest()
    data.sorted.Measurements = data.sorted.Measurements.map(field => ({ ...field, IsChecked: false }))
    const original = structuredClone(data), { onChange, onConfigureGrouping, onConfigureMeasures } = show(data)
    const button = screen.getByRole('button', { name: enable }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expectNoCaption(button)
    expect(screen.queryByRole('button', { name: `Налаштувати групування для ${name}` })).toBeNull()
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: `Налаштувати показники для ${name}` }))
    expect(onConfigureMeasures).toHaveBeenCalledOnce()
    expect(onConfigureGrouping).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(data).toEqual(original)
  })

  it('offers both prerequisite actions and never enables a rule on render', () => {
    const data = inactiveRequest()
    data.sorted.Row = []
    data.sorted.Measurements = []
    const { onChange } = show(data)
    const button = screen.getByRole('button', { name: enable }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expectNoCaption(button)
    expect(screen.getByRole('button', { name: `Налаштувати групування для ${name}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Налаштувати показники для ${name}` })).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('uses only existing fields after an explicit enable click and keeps inputs unchanged', () => {
    const data = inactiveRequest(), original = structuredClone(data), { onChange } = show(data)
    const button = screen.getByRole('button', { name: enable }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledOnce()
    const rule = onChange.mock.calls[0][0]
    expect(rule.Version).toBe(1)
    expect(data.sorted.Row.some(field => field.type === rule.Grouping)).toBe(true)
    expect(data.sorted.Measurements.some(field => field.Type === rule.Measure && field.IsChecked)).toBe(true)
    expect(data).toEqual(original)
  })

  it('preserves an unsupported stored rule and removes it only on explicit disable', () => {
    const data: ReportRequestBody = name === 'TOP' ? topRequest() : abcRequest()
    if (name === 'TOP') data.topGroups = { Version: 99, Future: 'preserve' }
    else data.abcClassification = { Version: 99, Future: 'preserve' }
    const original = structuredClone(data), { onChange } = show(data)
    expect(screen.getByRole('alert').textContent).toContain('Невідома версія')
    expect(onChange).not.toHaveBeenCalled()
    expect(data).toEqual(original)
    fireEvent.click(screen.getByRole('button', { name: disable }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(data).toEqual(original)
  })

  it('honors the parent lock for toggles and prerequisite navigation', () => {
    const data = inactiveRequest()
    data.sorted.Row = []
    const { onChange, onConfigureGrouping } = show(data, dataset, true)
    const button = screen.getByRole('button', { name: enable }) as HTMLButtonElement
    const navigate = screen.getByRole('button', { name: `Налаштувати групування для ${name}` }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(navigate.disabled).toBe(true)
    expectNoCaption(button)
    fireEvent.click(button)
    fireEvent.click(navigate)
    expect(onChange).not.toHaveBeenCalled()
    expect(onConfigureGrouping).not.toHaveBeenCalled()
  })

  it('shows no technical calculation disclosure', () => {
    show()
    expect(screen.queryByText(`Як працює ${name}`)).toBeNull()
  })
})
