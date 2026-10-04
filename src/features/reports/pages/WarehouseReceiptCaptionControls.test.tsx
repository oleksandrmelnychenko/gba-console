import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { pointContext, pointReceipt, pointCaption, incompletePointContext } from '../testing/receiptPointFixtures'
import { receiptChoiceValues, type ReceiptCaptionContext, type WarehouseReceiptKey } from '../data/warehouseReceiptCaptions'
import { WarehouseReceiptCaptionControls } from './WarehouseReceiptCaptionControls'
function Harness({ context, scope = 'caller-period-products' }: { context?: ReceiptCaptionContext; scope?: string }) {
  const [state, change] = useState<{ scope: string; selected: WarehouseReceiptKey[] }>({ scope, selected: [] })
  const selected = state.scope === scope ? state.selected : []
  return <MantineProvider env="test"><I18nProvider><WarehouseReceiptCaptionControls supported enabled scope={scope} context={context} selected={selected} busy={false}
    toggle={() => {}} select={values => change({ scope, selected: receiptChoiceValues(values, context, selected) })} />
    <output aria-label="Кількість вибраних документів">{selected.length}</output></I18nProvider></MantineProvider>
}
it('shared receipt controls retain genuine selected labels after incomplete and empty contexts and can clear them', async () => {
  const context = pointContext(), view = render(<Harness context={context} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name: pointCaption }))
  await waitFor(() => expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('1'))
  view.rerender(<Harness context={incompletePointContext()} />)
  expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.getByText(pointCaption)).toBeTruthy(); expect(screen.queryByText(pointReceipt.Reference)).toBeNull()
  view.rerender(<Harness context={{ ...pointContext(), Choices: [], RequiredChoiceTupleCount: 0, SelectedReceiptScopeComplete: false }} />)
  expect(screen.getByText(pointCaption)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Очистити відбір документів' }))
  await waitFor(() => expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('0'))
  expect(screen.queryByText(pointCaption)).toBeNull(); expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
})
it('shared receipt controls remove one full tuple without losing another selected kind with the same reference', async () => {
  const context = pointContext(), other = { ...pointReceipt, Table: '000000AF' }
  context.Choices.push({ Receipt: other, Caption: 'Інший документ' }); context.RequiredChoiceTupleCount = 2
  const view = render(<Harness context={context} />)
  for (const name of [pointCaption, 'Інший документ']) {
    fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name }))
  }
  await waitFor(() => expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('2'))
  view.rerender(<Harness context={incompletePointContext()} />)
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Документи надходження' }), { key: 'Backspace' })
  await waitFor(() => expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('1'))
  expect(screen.getByText(pointCaption)).toBeTruthy(); expect(screen.queryByText('Інший документ')).toBeNull()
})
it('shared receipt controls discard names and selections when their caller or report scope changes', async () => {
  const view = render(<Harness context={pointContext()} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name: pointCaption }))
  await waitFor(() => expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('1'))
  view.rerender(<Harness scope="other-caller-or-period" />)
  expect(screen.getByLabelText('Кількість вибраних документів').textContent).toBe('0'); expect(screen.queryByText(pointCaption)).toBeNull()
  expect(screen.queryByText(pointReceipt.Reference)).toBeNull()
})
