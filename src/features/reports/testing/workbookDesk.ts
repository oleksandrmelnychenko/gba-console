import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'

export function findWorkbookLanding() {
  return screen.findByRole('heading', { name: 'Звіти' })
}

export async function findOpenedWorkbook(fileName: string) {
  const switcher = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(switcher).getByRole('button', { name: `Відкрити ${fileName}` })
    .getAttribute('aria-current')).toBe('true'))
  return switcher
}

export function expandWorkbookSettings() {
  const toggle = screen.queryByRole('button', { name: 'Змінити налаштування' })
  if (toggle) fireEvent.click(toggle)
}

export function openWorkbookAdvanced() {
  openWorkbookSettingsSection('Додатково')
}

export function openWorkbookSettingsSection(name: string) {
  expandWorkbookSettings()
  fireEvent.click(screen.getByRole('button', { name }))
}
