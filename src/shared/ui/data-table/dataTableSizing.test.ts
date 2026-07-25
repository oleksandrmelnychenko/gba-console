import { describe, expect, it } from 'vitest'
import {
  getManuallySizedColumnIds,
  preserveRenderedColumnResize,
} from './dataTableSizing'

describe('preserveRenderedColumnResize', () => {
  it('applies a drag delta to the rendered fill width', () => {
    expect(
      preserveRenderedColumnResize(
        { client: 430 },
        new Map([['client', 320]]),
        new Map([['client', 723]]),
      ),
    ).toEqual({ client: 833 })
  })

  it('leaves regular column resizing unchanged', () => {
    const nextSizing = { number: 210 }

    expect(
      preserveRenderedColumnResize(
        nextSizing,
        new Map([['number', 170]]),
        new Map([['number', 170]]),
      ),
    ).toBe(nextSizing)
  })
})

describe('getManuallySizedColumnIds', () => {
  it('keeps default sizes eligible for auto-fill', () => {
    expect(
      [...getManuallySizedColumnIds(
        { number: 170, client: 420 },
        { number: 170 },
      )],
    ).toEqual(['client'])
  })
})
