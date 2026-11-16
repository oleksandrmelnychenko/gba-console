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
