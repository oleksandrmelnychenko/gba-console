import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ProtocolDetail } from '../detailTypes'
import { StatusSection } from './StatusSection'

vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('StatusSection', () => {
  it('names the target status and warns the change cannot be undone', () => {
    render(
      <MantineProvider>
        <StatusSection canEdit isUpdating={false} protocol={{ IsCompleted: false, IsShipped: true } as ProtocolDetail} onChangeStatus={vi.fn()} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Прибув' }))
    expect(screen.getByText(/Змінити статус протоколу на «Прибув»\?/).textContent).toContain('Цю зміну не можна скасувати.')
  })
})
