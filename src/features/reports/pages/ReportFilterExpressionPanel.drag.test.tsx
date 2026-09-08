import { MantineProvider } from '@mantine/core'
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { expressionDataset, expressionRequest, nestedExpression } from '../data/reportFilterExpression.test-fixtures'
import { ReportFilterExpressionPanel } from './ReportFilterExpressionPanel'
import { removeFilterSelection } from '../data/reportFilterExpression'

type DragEnd = (event: { active: { id: string }; over: { id: string } }) => void
const drag = vi.hoisted(() => ({ start: () => {}, end: (() => {}) as DragEnd }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragStart, onDragEnd }: { children: React.ReactNode; onDragStart: () => void; onDragEnd: typeof drag.end }) => {
    drag.start = onDragStart; drag.end = onDragEnd; return children
  },
  PointerSensor: class {}, useSensor: () => ({}), useSensors: () => [],
  useDraggable: () => ({ setNodeRef: () => {}, listeners: {}, attributes: {}, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}))

it('shares the exact move operation for a drop and refuses stale path IDs after a condition was deleted during dragging', () => {
  const data = expressionRequest(), onChange = vi.fn()
  const props = { data, dataset: expressionDataset, disabled: false, notice: null, onChange }
  const view = render(<MantineProvider env="test"><ReportFilterExpressionPanel {...props} /></MantineProvider>)
  act(() => { drag.start(); drag.end({ active: { id: '0' }, over: { id: 'target:1' } }) })
  expect(onChange).toHaveBeenCalledWith({ Version: 1, Root: { Kind: 1, Children: [{ Kind: 2, Children: [
    { Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 2 }, { Kind: 3, SelectionIndex: 1 },
  ] }] } })
  onChange.mockClear()
  act(() => drag.start())
  const changed = { ...data, selections: data.selections.slice(1), filterExpression: removeFilterSelection(nestedExpression, 0) }
  view.rerender(<MantineProvider env="test"><ReportFilterExpressionPanel {...props} data={changed} /></MantineProvider>)
  act(() => drag.end({ active: { id: '0' }, over: { id: 'target:1' } }))
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByText(/Під час перетягування дерево змінилося/)).toBeTruthy()
})
