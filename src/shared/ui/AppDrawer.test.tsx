import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppDrawer, AppDrawerFooter } from './AppDrawer'

function NestedForm() {
  const [footerVisible, setFooterVisible] = useState(false)
  const [value, setValue] = useState('')

  return (
    <>
      <label>
        Name
        <input value={value} onChange={(event) => setValue(event.currentTarget.value)} />
      </label>
      <button type="button" onClick={() => setFooterVisible((visible) => !visible)}>
        Toggle actions
      </button>
      {footerVisible && (
        <AppDrawerFooter>
          <button type="button">Save nested form</button>
        </AppDrawerFooter>
      )}
    </>
  )
}

describe('AppDrawer', () => {
  it('renders the shared header and pinned footer', async () => {
    render(
      <MantineProvider>
        <AppDrawer
          footer={<button type="button">Save</button>}
          opened
          title="Edit item"
          onClose={vi.fn()}
        >
          <div>Drawer content</div>
        </AppDrawer>
      </MantineProvider>,
    )

    expect(await screen.findByRole('dialog', { name: 'Edit item' })).toBeTruthy()
    expect(screen.getByText('Drawer content')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' }).closest('.app-sheet-footer')).toBeTruthy()
    expect(
      document
        .querySelector<HTMLElement>('.mantine-Drawer-root')
        ?.style.getPropertyValue('--drawer-size'),
    ).toBe('min(1200px, 100vw)')
  })

  it('keeps short forms compact when requested explicitly', async () => {
    render(
      <MantineProvider>
        <AppDrawer opened size="compact" title="Short form" onClose={vi.fn()}>
          <input aria-label="Code" />
        </AppDrawer>
      </MantineProvider>,
    )

    expect(await screen.findByRole('dialog', { name: 'Short form' })).toBeTruthy()
    expect(
      document
        .querySelector<HTMLElement>('.mantine-Drawer-root')
        ?.style.getPropertyValue('--drawer-size'),
    ).toBe('min(560px, 100vw)')
  })

  it('keeps nested form state when its contextual footer appears', async () => {
    render(
      <MantineProvider>
        <AppDrawer opened title="Nested form" onClose={vi.fn()}>
          <NestedForm />
        </AppDrawer>
      </MantineProvider>,
    )

    const input = await screen.findByRole('textbox', { name: 'Name' })
    fireEvent.change(input, { target: { value: 'Preserved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Toggle actions' }))

    const saveButton = await screen.findByRole('button', { name: 'Save nested form' })

    expect(saveButton.closest('.app-sheet-footer')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('value')).toBe('Preserved')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle actions' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save nested form' })).toBeNull()
    })
    expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('value')).toBe('Preserved')
  })
})
