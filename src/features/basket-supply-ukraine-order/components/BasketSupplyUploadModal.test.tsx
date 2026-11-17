import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BasketSupplyUploadModal } from './BasketSupplyUploadModal'

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function renderModal(onSubmit = vi.fn()) {
  render(
    <MantineProvider>
      <BasketSupplyUploadModal
        isSubmitting={false}
        mode="load"
        opened
        submitError={null}
        t={(key) => key}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    </MantineProvider>,
  )

  return onSubmit
}

const input = (label: string) => screen.getAllByLabelText(new RegExp(`^${label}`)).find(
  (element) => element.tagName === 'INPUT',
) as HTMLInputElement

describe('BasketSupplyUploadModal', () => {
  it('marks the date and priority columns as required and names them when missing', () => {
    const onSubmit = renderModal()

    for (const label of ['Колонка дати', 'Колонка пріоритету']) {
      expect(input(label).closest('.mantine-InputWrapper-root')?.querySelector('.mantine-InputWrapper-required')).not.toBeNull()
    }
    fireEvent.change(input('Колонка коду виробника'), { target: { value: '1' } })
    fireEvent.change(input('Колонка кількості'), { target: { value: '2' } })
    fireEvent.change(input('З рядка'), { target: { value: '2' } })
    fireEvent.change(input('До рядка'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Колонка дати, Колонка пріоритету$/)).toBeTruthy()
  })

  it('does not accept a minus sign in column numbers', () => {
    renderModal()
    const vendorCode = input('Колонка коду виробника')

    fireEvent.change(vendorCode, { target: { value: '-5' } })
    expect(vendorCode.value).not.toContain('-')
  })
})
