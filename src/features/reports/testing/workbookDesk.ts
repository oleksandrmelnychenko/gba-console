import { fireEvent, screen } from '@testing-library/react'

export function findWorkbookLanding() {
  return screen.findByRole('heading', { name: 'Звіти 1С' })
}

export function expandWorkbookSettings() {
  const toggle = screen.queryByRole('button', { name: 'Змінити налаштування' })
  if (toggle) fireEvent.click(toggle)
}

function openDetails(label: string) {
  const details = screen.getByText(label).closest('details')
  if (details) details.open = true
}

export function openWorkbookAdvanced() {
  openDetails('Додатково')
}

export function openOtherWaysToOpen() {
  openDetails('Інші способи відкрити звіт')
}
