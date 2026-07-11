import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
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
})
