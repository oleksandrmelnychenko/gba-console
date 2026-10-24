import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AnalysisTopEntry } from './AnalysisTopEntry'
const capability = { version: 1 as const, allowedValues: ['A', 'B', 'C', 'D', 'O', 'X9', 'N'] }
it('accepts a manual supported code without requiring a current catalogue match, preserves historical values and deduplicates text aliases', () => {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><AnalysisTopEntry capability={capability} onChange={onChange}
    selection={{ IsChecked: true, SelectedField: { Type: 3, Name: 'TOP' }, FilterCondition: { Type: 2, Name: 'У списку' },
      Values: [{ Data: { name: 'A' }, Name: 'A', Value: 0 }, { Data: { value: 'OLD' }, Name: 'OLD', Value: 0 }] }} /></MantineProvider>)
  fireEvent.change(screen.getByLabelText('TOP вручну'), { target: { value: ' a ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Додати TOP' }))
  expect(onChange).toHaveBeenLastCalledWith([{ Data: { value: 'OLD' }, Name: 'OLD', Value: 0 }, { Data: { value: 'A' }, Name: 'A', Value: 0 }])
  fireEvent.change(screen.getByLabelText('TOP вручну'), { target: { value: 'Z' } })
  expect(screen.getByRole('button', { name: 'Додати TOP' }).hasAttribute('disabled')).toBe(true)
  fireEvent.keyDown(screen.getByLabelText('TOP вручну'), { key: 'Enter' })
  expect(onChange).toHaveBeenCalledTimes(1)
})
