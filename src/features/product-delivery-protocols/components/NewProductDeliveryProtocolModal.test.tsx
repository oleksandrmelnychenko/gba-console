import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NewProductDeliveryProtocolModal } from './NewProductDeliveryProtocolModal'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

describe('NewProductDeliveryProtocolModal', () => {
  it('offers exactly the operational organizations shown in company resources', () => {
    render(
      <MantineProvider>
        <NewProductDeliveryProtocolModal
          createError={null}
          isCreating={false}
          opened
          organizations={[
            { NetUid: 'amg', Name: 'ТОВ «АМГ «КОНКОРД»' },
            { NetUid: 'fenix', Name: 'Фенікс' },
            { NetUid: 'pack', Name: 'ТОВ "ПАК "Конкорд"' },
            { NetUid: 'factory', Name: 'ТОВ "Хмельницький агрегатний завод"' },
          ]}
          organizationsError={null}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Організація' }))

    expect(screen.getByRole('option', { name: 'ТОВ «АМГ «КОНКОРД»' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Фенікс' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'ТОВ "ПАК "Конкорд"' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'ТОВ "Хмельницький агрегатний завод"' })).toBeNull()
  })
})
