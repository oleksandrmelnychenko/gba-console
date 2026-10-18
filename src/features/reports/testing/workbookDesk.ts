import { fireEvent, screen } from '@testing-library/react'

export function findWorkbookLanding() {
  return screen.findByRole('heading', { name: 'Звіти' })
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
  openWorkbookSettingsSection('Додатково')
}

export function openOtherWaysToOpen() {
  openDetails('Інші способи відкрити звіт')
}

export function openWorkbookSettingsSection(name: string) {
  expandWorkbookSettings()
  fireEvent.click(screen.getByRole('button', { name }))
}
