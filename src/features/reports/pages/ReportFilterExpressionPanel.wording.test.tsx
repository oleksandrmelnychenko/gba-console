import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { expressionDataset, expressionRequest } from '../data/reportFilterExpression.test-fixtures'
import { ReportFilterExpressionPanel } from './ReportFilterExpressionPanel'

it('offers «Додати групу» at the top level and names nested groups by number', () => {
  const props = { data: expressionRequest(), dataset: expressionDataset, disabled: false, notice: null, onChange: vi.fn() }
  render(<MantineProvider env="test"><ReportFilterExpressionPanel {...props} /></MantineProvider>)
  const labels = screen.getAllByRole('button').map(button => button.textContent ?? '').filter(text => text.startsWith('Додати групу'))
  expect(labels).toContain('Додати групу')
  expect(document.body.textContent).not.toContain('Коренева')
  expect(screen.getAllByLabelText('Оператор — Усі умови').length).toBeGreaterThan(0)
  expect(labels.some(text => text.includes('Коренева'))).toBe(false)
  expect(labels.filter(text => text !== 'Додати групу').every(text => /^Додати групу в Група \d/.test(text))).toBe(true)
})

it('names conditions like the dropdown and shows a ticked row without a value as unfinished, not switched off', () => {
  const data = expressionRequest()
  data.selections = data.selections.map((selection, index) => index === 0
    ? { ...selection, FilterCondition: { Type: 3, Name: 'У групі зі списку' } }
    : index === 1 ? { ...selection, IsChecked: true, Values: [] } : selection)
  render(<MantineProvider env="test"><ReportFilterExpressionPanel data={data} dataset={expressionDataset} disabled={false} notice={null} onChange={vi.fn()} /></MantineProvider>)
  const text = document.body.textContent ?? ''
  expect(text).toContain('В групі зі списку')
  expect(text).not.toContain('У групі зі списку')
  expect(text).toMatch(/№2: .+ — значення не задано/)
  expect(text).not.toMatch(/№2: [^№]*\(вимкнено\)/)
})

it('keeps the movement wording when the tree has no report dataset behind it', () => {
  const data = expressionRequest()
  data.selections = data.selections.map((selection, index) => index === 0 ? { ...selection, FilterCondition: { Type: 2, Name: 'Містить' } } : selection)
  render(<MantineProvider env="test"><ReportFilterExpressionPanel data={data} dataset={{ ...expressionDataset, DataSource: undefined } as never} disabled={false} notice={null} onChange={vi.fn()} /></MantineProvider>)
  expect(document.body.textContent).toContain('Містить')
})

it('shows a ticked row whose only value is blank text as unfinished', () => {
  const data = expressionRequest()
  data.selections = data.selections.map((selection, index) => index === 1 ? { ...selection, IsChecked: true, Values: [{ Name: ' ', Value: 0, Data: { Id: 0 } }] } : selection)
  render(<MantineProvider env="test"><ReportFilterExpressionPanel data={data} dataset={expressionDataset} disabled={false} notice={null} onChange={vi.fn()} /></MantineProvider>)
  expect(document.body.textContent).toMatch(/№2: .+ — значення не задано/)
})
