import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'

let granted = false

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => granted,
  }),
}))

import { Can } from './Can'

describe('Can', () => {
  beforeEach(() => {
    granted = false
  })

  it('hides denied content by default', () => {
    render(
      <Can permission={PermissionKeys.SalesUkraine.Sale.Delete}>
        <button type="button">Видалити</button>
      </Can>,
    )

    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
  })

  it('disables a denied control and exposes the reason', () => {
    render(
      <Can
        deniedReason="Недостатньо прав для видалення"
        mode="disable"
        permission={PermissionKeys.SalesUkraine.Sale.Delete}
      >
        <button type="button">Видалити</button>
      </Can>,
    )

    const button = screen.getByRole('button', { name: 'Видалити' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toBe('Недостатньо прав для видалення')
  })

  it('renders an allowed control unchanged', () => {
    granted = true

    render(
      <Can mode="disable" permission={PermissionKeys.SalesUkraine.Sale.Delete}>
        <button type="button">Видалити</button>
      </Can>,
    )

    expect((screen.getByRole('button', { name: 'Видалити' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
