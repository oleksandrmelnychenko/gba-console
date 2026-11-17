import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ChangeCommentModal } from './ChangeCommentModal'

describe('ChangeCommentModal', () => {
  it('limits the comment to 450 characters and does not save twice while saving', () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <MantineProvider><I18nProvider>
        <ChangeCommentModal comment="Старий" isSaving={false} opened onClose={() => {}} onSave={onSave} />
      </I18nProvider></MantineProvider>,
    )

    expect(screen.getByLabelText('Коментар').getAttribute('maxlength')).toBe('450')

    rerender(
      <MantineProvider><I18nProvider>
        <ChangeCommentModal comment="Старий" isSaving opened onClose={() => {}} onSave={onSave} />
      </I18nProvider></MantineProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSave).not.toHaveBeenCalled()
  })
})
