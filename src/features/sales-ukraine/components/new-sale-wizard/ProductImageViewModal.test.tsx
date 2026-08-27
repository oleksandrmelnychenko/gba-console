import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { ProductImageViewModal } from './ProductImageViewModal'

describe('ProductImageViewModal', () => {
  it('contains the enlarged photo, uses the fallback and isolates keyboard events from the wizard', () => {
    const onClose = vi.fn()
    const onEditCart = vi.fn()
    const onWizardKeyDown = vi.fn()
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <div onKeyDown={onWizardKeyDown}>
            <ProductImageViewModal
              fallbackSrc="/fallback.jpg"
              imageName="Амортизатор"
              imageUrl="/photo.jpg"
              onClose={onClose}
              onEditCart={onEditCart}
            />
          </div>
        </I18nProvider>
      </MantineProvider>,
    )
    const preview = within(screen.getByRole('dialog', { name: 'Перегляд зображення' }))
    const photo = preview.getByRole('img', { name: 'Амортизатор' }) as HTMLImageElement
    expect(photo.style.getPropertyValue('--image-object-fit')).toBe('contain')
    expect(photo.style.maxHeight).toBe('70vh')
    fireEvent.error(photo)
    expect(photo.getAttribute('src')).toBe('/fallback.jpg')

    const closeButton = preview.getByRole('button', { name: 'Закрити фото' })
    fireEvent.keyDown(closeButton, { key: 'Enter' })
    fireEvent.keyDown(closeButton, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(closeButton, { key: 'F2' })
    expect(onEditCart).toHaveBeenCalledOnce()
    expect(onWizardKeyDown).not.toHaveBeenCalled()
  })
})
