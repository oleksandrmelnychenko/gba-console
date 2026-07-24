import { Button, MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppModal, AppModalFooter } from './AppModal'

describe('AppModal', () => {
  it('applies the shared compact shell and semantic footer', async () => {
    render(
      <MantineProvider>
        <AppModal opened title="Edit item" onClose={vi.fn()}>
          <div>Modal content</div>
          <AppModalFooter>
            <Button variant="default">Cancel</Button>
            <Button>Save</Button>
          </AppModalFooter>
        </AppModal>
      </MantineProvider>,
    )

    expect(await screen.findByRole('dialog', { name: 'Edit item' })).toBeTruthy()
    expect(document.querySelector('.mantine-Modal-root.app-modal.app-form-sheet')).toBeTruthy()
    expect(document.querySelector('.app-modal-resize')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' }).closest('.app-modal-footer')).toBeTruthy()
    expect(
      document
        .querySelector<HTMLElement>('.mantine-Modal-root')
        ?.style.getPropertyValue('--modal-size'),
    ).toBe('calc(31rem * var(--mantine-scale))')
  })

  it('keeps full-screen workspaces outside the compact resize shell', async () => {
    render(
      <MantineProvider>
        <AppModal opened title={null} variant="workspace" onClose={vi.fn()}>
          <div>Workspace content</div>
        </AppModal>
      </MantineProvider>,
    )

    expect(await screen.findByText('Workspace content')).toBeTruthy()
    expect(document.querySelector('.mantine-Modal-root.app-modal--workspace')).toBeTruthy()
    expect(document.querySelector('.app-modal-resize')).toBeNull()
  })
})
