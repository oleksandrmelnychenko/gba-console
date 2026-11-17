import { fireEvent, screen, within } from '@testing-library/react'

export function removeGrouping(caption: string) {
  const item = screen.getAllByRole('region').filter(region => /^Групування (рядків|колонок)$/.test(region.getAttribute('aria-label') ?? ''))
    .map(region => within(region).queryByRole('button', { name: caption })).find(Boolean)
  if (!item) return false
  if (item.getAttribute('aria-pressed') !== 'true') fireEvent.click(item)
  fireEvent.click(screen.getByRole('button', { name: `Видалити ${caption}` }))
  return true
}

export function addGroupings(axis: 'рядків' | 'колонок', checkboxes: string[]) {
  fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
  const dialog = screen.getByRole('dialog', { name: `Додати поле для групування ${axis}` })
  for (const name of checkboxes) fireEvent.click(within(dialog).getByRole('checkbox', { name }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Додати вибрані' }))
}

export function applyOrganizationProductSalesLayout() {
  removeGrouping('Відповідальний менеджер що перевів в статус накладної')
  removeGrouping('Відповідальний менеджер що забив товар')
  addGroupings('рядків', ['Вибрати Назва товару'])
}

export function generateButton() {
  return screen.queryAllByRole('button', { name: 'Сформувати' })[0] ?? screen.getByRole('button', { name: 'Застосувати й показати' })
}
