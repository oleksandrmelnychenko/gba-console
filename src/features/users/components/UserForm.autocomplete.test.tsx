import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createEmptyUserProfile } from '../utils'
import { UserForm } from './UserForm'

describe('new user credential fields', () => {
  it('starts empty and prevents saved credentials from being reused', () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <UserForm
            includePassword
            roles={[]}
            user={createEmptyUserProfile()}
            onFieldChange={vi.fn()}
            onPasswordChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const email = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement
    const password = document.querySelector('input[autocomplete="new-password"]') as HTMLInputElement
    const newPasswordFields = document.querySelectorAll('input[autocomplete="new-password"]')

    expect(email.value).toBe('')
    expect(email.autocomplete).toBe('off')
    expect(newPasswordFields).toHaveLength(2)
    expect(password.value).toBe('')
  })

  it('keeps the normal email autocomplete contract on edit forms', () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <UserForm
            roles={[]}
            user={{ ...createEmptyUserProfile(), Email: 'current@example.com' }}
            onFieldChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const email = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement

    expect(email.value).toBe('current@example.com')
    expect(email.autocomplete).toBe('email')
  })
})
