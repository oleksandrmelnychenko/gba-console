import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReportRequestBody } from '../types'
import { ConstructorPresentationPanel } from './ConstructorPresentationPanel'
import { ownPresentationDataset, ownPresentationRequest, ownPresentationSources, presentationCombinations } from '../data/constructorPresentation.native.test-fixtures'

afterEach(() => { cleanup() })
const negative = 'Від’ємні значення червоним', grand = 'Загальний підсумок'
function Harness({ source, initial }: { source: number; initial?: unknown }) {
  const [request, setRequest] = useState<ReportRequestBody>({ ...ownPresentationRequest(source),
    ...(initial === undefined ? {} : { constructorPresentation: initial }) })
  return <MantineProvider env="test"><ConstructorPresentationPanel dataset={ownPresentationDataset(source)} request={request} disabled={false}
    onChange={value => setRequest(current => ({ ...current, constructorPresentation: value }))} />
    <button onClick={() => setRequest(current => ({ ...current, from: '2026-10-10', to: '2026-10-25' }))}>Інший період</button>
    <output data-testid="draft">{JSON.stringify(request)}</output></MantineProvider>
}
it.each(ownPresentationSources)('offers opt-in false/true controls without writing defaults for source%i', source => {
  const request = ownPresentationRequest(source), onChange = vi.fn()
  render(<MantineProvider env="test"><ConstructorPresentationPanel dataset={ownPresentationDataset(source)} request={request} disabled={false} onChange={onChange} /></MantineProvider>)
  const panel = screen.getByRole('group', { name: 'Оформлення звіту' })
  expect((within(panel).getByRole('checkbox', { name: negative }) as HTMLInputElement).checked).toBe(false)
  expect((within(panel).getByRole('checkbox', { name: grand }) as HTMLInputElement).checked).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
  expect(Object.hasOwn(request, 'constructorPresentation')).toBe(false)
})
it.each(ownPresentationSources)('uses both actual controls through all four explicit states for source%i', source => {
  render(<Harness source={source} />)
  const state = () => JSON.parse(screen.getByTestId('draft').textContent!).constructorPresentation
  fireEvent.click(screen.getByRole('checkbox', { name: negative }))
  expect(state()).toEqual({ version: 1, negativeRed: true, grandTotals: true })
  fireEvent.click(screen.getByRole('checkbox', { name: grand }))
  expect(state()).toEqual({ version: 1, negativeRed: true, grandTotals: false })
  fireEvent.click(screen.getByRole('checkbox', { name: negative }))
  expect(state()).toEqual({ version: 1, negativeRed: false, grandTotals: false })
  fireEvent.click(screen.getByRole('checkbox', { name: grand }))
  expect(state()).toEqual({ version: 1, negativeRed: false, grandTotals: true })
})
it.each(ownPresentationSources.flatMap(source => presentationCombinations.map(flags => ({ source, flags }))))('restores explicit source$source flags $flags', ({ source, flags }) => {
  render(<Harness source={source} initial={flags} />)
  expect((screen.getByRole('checkbox', { name: negative }) as HTMLInputElement).checked).toBe(flags.negativeRed)
  expect((screen.getByRole('checkbox', { name: grand }) as HTMLInputElement).checked).toBe(flags.grandTotals)
})
it.each(ownPresentationSources)('hides corrupt, missing or foreign capability and incompatible modes for source%i', source => {
  const dataset = ownPresentationDataset(source), request = ownPresentationRequest(source), onChange = vi.fn()
  const cases = [
    { dataset: { ...dataset, constructorPresentation: undefined }, request },
    { dataset: { ...dataset, constructorPresentation: { version: 1, fields: ['negativeRed','grandTotals'], details: true } }, request },
    { dataset: { ...dataset, DataSource: source === 3 ? 45 : 3 }, request },
    { dataset, request: { ...request, returnsOnly: false } },
    { dataset, request: { ...request, reportProfile: 'sales' } },
  ]
  for (const props of cases) {
    const view = render(<MantineProvider env="test"><ConstructorPresentationPanel {...props} disabled={false} onChange={onChange} /></MantineProvider>)
    expect(screen.queryByRole('group', { name: 'Оформлення звіту' })).toBeNull()
    view.unmount()
  }
  expect(onChange).not.toHaveBeenCalled()
})
it.each(ownPresentationSources)('disables both own-source controls while report changes are locked for source%i', source => {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><ConstructorPresentationPanel dataset={ownPresentationDataset(source)} request={ownPresentationRequest(source)} disabled onChange={onChange} /></MantineProvider>)
  for (const label of [negative, grand]) expect((screen.getByRole('checkbox', { name: label }) as HTMLInputElement).disabled).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
})
it.each(ownPresentationSources)('keeps explicit own-source choices during a changed period for source%i', source => {
  const flags = { version: 1, negativeRed: true, grandTotals: false }
  render(<Harness source={source} initial={flags} />)
  fireEvent.click(screen.getByRole('button', { name: 'Інший період' }))
  const request = JSON.parse(screen.getByTestId('draft').textContent!)
  expect(request.constructorPresentation).toEqual(flags)
  expect(request.from).toBe('2026-10-10')
  expect(request.to).toBe('2026-10-25')
})
it.each([{ source: 2, profile: 'sales', red: true }, { source: 2, profile: 'grossProfit', red: true }, { source: 44, profile: undefined, red: false }])('preserves existing source$source/$profile defaults', ({ source, profile, red }) => {
  render(<MantineProvider env="test"><ConstructorPresentationPanel dataset={ownPresentationDataset(source)}
    request={{ ...ownPresentationRequest(source), ...(profile ? { reportProfile: profile } : {}) }} disabled={false} onChange={() => {}} /></MantineProvider>)
  expect((screen.getByRole('checkbox', { name: negative }) as HTMLInputElement).checked).toBe(red)
  expect((screen.getByRole('checkbox', { name: grand }) as HTMLInputElement).checked).toBe(true)
})
