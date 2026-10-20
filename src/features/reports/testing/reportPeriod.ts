import { fireEvent, screen, within } from '@testing-library/react'

/** Drive the real portal and Apply button; closing without Apply discards reads. */
export function openReportPeriod() {
  const trigger = screen.getByRole('button', { name: /^Період:/ })
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger)
  return screen.getByRole('dialog', { name: 'Період' })
}

export function changeReportPeriod(range: { from?: string; to?: string }) {
  const dialog = openReportPeriod()
  if (range.from !== undefined) fireEvent.change(within(dialog).getByLabelText(/^(Від|Поточний період: від)$/), { target: { value: range.from } })
  if (range.to !== undefined) fireEvent.change(within(dialog).getByLabelText(/^(До|Поточний період: до)$/), { target: { value: range.to } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Застосувати' }))
}

export function readReportDateInput(label: string): HTMLInputElement {
  const dialog = openReportPeriod()
  const input = within(dialog).getByLabelText(label) as HTMLInputElement
  fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
  return input
}
