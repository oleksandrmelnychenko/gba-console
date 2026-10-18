import { fireEvent, screen, within } from '@testing-library/react'

export function chooseTemplateAction(template: string, action: string) {
  fireEvent.click(within(screen.getByRole('group', { name: template })).getByRole('button', { name: `Дії шаблону: ${template}` }))
  fireEvent.click(screen.getByRole('menuitem', { name: action }))
}
