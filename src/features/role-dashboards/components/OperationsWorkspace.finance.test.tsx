import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OperationsWorkspace } from './OperationsWorkspace'

vi.mock('../../navigation/hooks/useNavigation', () => ({
  useNavigation: () => ({
    modules: [{ Children: [
      { Route: '/accounting/payment-accounts', Children: [] },
      { Route: '/accounting/sync/documents', Children: [] },
    ] }],
  }),
}))

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output> }

describe('finance dashboard shortcuts', () => {
  it('opens the GBA payment register balances instead of synchronised documents', () => {
    render(<MantineProvider><I18nProvider><MemoryRouter>
      <OperationsWorkspace summary={null} error={null} workspaceKey="finance" /><Location />
    </MemoryRouter></I18nProvider></MantineProvider>)
    const balances = screen.getByText('Баланси').closest('button')
    expect(balances?.getAttribute('title')).toBe('Залишки на рахунках і в касах')
    fireEvent.click(balances as HTMLElement)
    expect(screen.getByTestId('location').textContent).toBe('/accounting/payment-accounts')
    expect(screen.queryByTitle(/Синхронізовані/)).toBeNull()
  })
})
