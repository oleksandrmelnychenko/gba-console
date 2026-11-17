import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ProductCapitalizationUploadModal } from './ProductCapitalizationUploadModal'

describe('ProductCapitalizationUploadModal', () => {
  it('shows the requested file picker text', () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCapitalizationUploadModal
            isSubmitting={false}
            opened
            submitError={null}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Оберіть файл')).toBeTruthy()
    expect(screen.queryByText('Оберіть файли')).toBeNull()
  })

  it('starts with code 1, quantity 2 and row 2, and asks for the file first', () => {
    const onSubmit = vi.fn()
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCapitalizationUploadModal
            isSubmitting={false}
            opened
            submitError={null}
            onClose={vi.fn()}
            onSubmit={onSubmit}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect((screen.getByLabelText('Артикул') as HTMLInputElement).value).toBe('1')
    expect((screen.getByLabelText('Кількість') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('З') as HTMLInputElement).value).toBe('2')
    expect(screen.getByText('Позиції з файлу буде додано до документа оприходування.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))

    expect(screen.getByText('Додайте файл.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
