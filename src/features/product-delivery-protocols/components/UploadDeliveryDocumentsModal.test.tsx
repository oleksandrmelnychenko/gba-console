import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { UploadDeliveryDocumentsModal } from './UploadDeliveryDocumentsModal'

describe('BUG-1186 customs declaration upload wording', () => {
  it('uses the customs declaration label in the upload modal', () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <UploadDeliveryDocumentsModal
            dateCustomDeclaration=""
            existingDocuments={[]}
            isSaving={false}
            newDocuments={[]}
            numberCustomDeclaration=""
            opened
            onAddFiles={vi.fn()}
            onChangeDateCustomDeclaration={vi.fn()}
            onChangeNumberCustomDeclaration={vi.fn()}
            onClose={vi.fn()}
            onRemoveExistingDocument={vi.fn()}
            onRemoveNewDocument={vi.fn()}
            onSave={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Завантаження митної декларації')).toBeTruthy()
    expect(screen.queryByText('Завантаження документів доставки')).toBeNull()
  })
})
