import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useReportFilterExpression } from './useReportFilterExpression'
import { expressionDataset, expressionRequest, nestedExpression } from '../data/reportFilterExpression.test-fixtures'
import { reportFilterExpressionError } from '../data/reportFilterExpression'

it('keeps indices stable across edits/toggles and removes only the explicitly deleted duplicate-valued condition', () => {
  const data = expressionRequest(); data.selections[1] = structuredClone(data.selections[0])
  const { result } = renderHook(useReportFilterExpression)
  act(() => result.current.load(data.selections, data.filterExpression))
  act(() => result.current.editSelection({ kind: 'replace', index: 0, selection: { ...data.selections[0], IsChecked: false } }))
  expect(result.current.expression).toEqual(nestedExpression)
  expect(result.current.selections.map(item => item.IsChecked)).toEqual([false, true, false])
  act(() => result.current.editSelection({ kind: 'delete', index: 1 }))
  expect(result.current.selections.map(item => item.SelectedField.Type)).toEqual([29, 9])
  expect(result.current.expression).toEqual({ Version: 1, Root: { Kind: 1, Children: [{ Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] }] } })
  expect(result.current.notice).toContain('Номери наступних умов узгоджено')
  expect(reportFilterExpressionError({ ...data, selections: result.current.selections, filterExpression: result.current.expression }, expressionDataset)).toBeNull()
  expect(data.selections[0].IsChecked).toBe(true)
})
it('adds an unassigned condition atomically without widening OR and leaves invalid raw trees untouched on index deletion', () => {
  const data = expressionRequest(), { result } = renderHook(useReportFilterExpression)
  act(() => result.current.load(data.selections, nestedExpression))
  act(() => result.current.editSelection({ kind: 'append', selection: data.selections[0] }))
  expect(result.current.expression).toEqual(nestedExpression)
  expect(result.current.notice).toContain('ще не включено')
  expect(reportFilterExpressionError({ ...data, selections: result.current.selections, filterExpression: result.current.expression }, expressionDataset)).toContain('№4')
  const raw = { Version: 99, Root: { Kind: 'future', Indices: [2] } }
  act(() => result.current.load(data.selections, raw))
  act(() => result.current.editSelection({ kind: 'delete', index: 0 }))
  expect(result.current.expression).toEqual(raw); expect(result.current.selections).toEqual(data.selections)
  expect(result.current.notice).toContain('Індекси невідомого дерева не змінено')
  act(() => result.current.change(undefined))
  expect(result.current.expression).toBeUndefined(); expect(result.current.selections).toEqual(data.selections)
  expect(result.current.notice).toContain('через І')
})
