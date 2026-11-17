import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { DepreciatedOrderCreateModal } from './DepreciatedOrderCreateModal'

function renderModal(onCreate = vi.fn()) {
  const modal = (opened: boolean) => (
    <MantineProvider>
      <I18nProvider>
        <DepreciatedOrderCreateModal
          canCreateManagement={false}
          createError={null}
          isCreating={false}
          isLoadingStorages={false}
          opened={opened}
          storageError={null}
          storages={[{ Name: 'QA Склад основний', NetUid: 'storage-1' }]}
          onClose={() => {}}
          onCreate={onCreate}
        />
      </I18nProvider>
    </MantineProvider>
  )
  /* Opened from the page: closed first, then opened (picks the default storage). */
  const view = render(modal(false))
  view.rerender(modal(true))

  return onCreate
}

describe('DepreciatedOrderCreateModal', () => {
  it('starts with the usual layout: code in column 1, quantity in column 2, from row 2', async () => {
    renderModal()

    expect((await screen.findByLabelText('Колонка артикула') as HTMLInputElement).value).toBe('1')
    expect((screen.getByLabelText('Колонка кількості') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Перший рядок') as HTMLInputElement).value).toBe('2')
    expect(screen.getByLabelText('Коментар').getAttribute('maxlength')).toBe('500')
  })

  it('asks for the file first when Списати is pressed without one', async () => {
    const onCreate = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Списати' }))

    expect(await screen.findByText('Додайте файл.')).toBeTruthy()
    expect(onCreate).not.toHaveBeenCalled()
  })
})
