import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { useUnsavedChangesGuard } from './UnsavedChangesGuard'

function Form({ isDirty, onClose }: { isDirty: boolean; onClose: () => void }) {
  const { guard, modal } = useUnsavedChangesGuard(isDirty)

  return (
    <>
      <button type="button" onClick={() => guard(onClose)}>close</button>
      {modal}
    </>
  )
}

function renderForm(isDirty: boolean) {
  const onClose = vi.fn()

  render(
    <MantineProvider>
      <I18nProvider>
        <Form isDirty={isDirty} onClose={onClose} />
      </I18nProvider>
    </MantineProvider>,
  )

  return onClose
}

describe('useUnsavedChangesGuard', () => {
  it('closes a pristine form at once', () => {
    const onClose = renderForm(false)

    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before a filled form is closed, and stays on «Залишитися»', () => {
    const onClose = renderForm(true)

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.getByText('Є незбережені зміни')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Залишитися' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити без збереження' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks the browser before a filled form is reloaded', () => {
    renderForm(true)
    const event = new Event('beforeunload', { cancelable: true })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })
})
