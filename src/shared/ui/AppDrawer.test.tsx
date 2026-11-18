import { MantineProvider, Modal } from '@mantine/core'
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
  it('closes only the nested dialog on Escape and itself on Escape from its own content', async () => {
    const closeDrawer = vi.fn()
    const closeModal = vi.fn()
    render(
      <MantineProvider>
        <AppDrawer opened title="Outer" onClose={closeDrawer}>
          <input aria-label="drawer field" />
          <Modal opened title="Export" onClose={closeModal}>
            <input aria-label="modal field" />
          </Modal>
        </AppDrawer>
      </MantineProvider>,
    )

    fireEvent.keyDown(await screen.findByLabelText('modal field'), { key: 'Escape' })
    expect(closeModal).toHaveBeenCalledOnce()
    expect(closeDrawer).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByLabelText('drawer field'), { key: 'Escape' })
    expect(closeDrawer).toHaveBeenCalledOnce()
  })

  it('closes only the topmost sheet on an Escape from the page body', async () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()
    render(
      <MantineProvider>
        <AppDrawer opened title="Новий перепродаж" onClose={closeOuter}>
          <div>Outer content</div>
        </AppDrawer>
        <AppDrawer opened title="Обробка перепродажу" onClose={closeInner}>
          <div>Inner content</div>
        </AppDrawer>
      </MantineProvider>,
    )

    await screen.findByText('Inner content')
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(closeInner).toHaveBeenCalledOnce()
    expect(closeOuter).not.toHaveBeenCalled()
  })

  it('gives an Escape from the page body to the sheet the user last worked in', async () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()
    render(
      <MantineProvider>
        <AppDrawer opened title="Outer" onClose={closeOuter}>
          <input aria-label="outer field" />
          <AppDrawer opened title="Inner" onClose={closeInner}>
            <input aria-label="inner field" />
          </AppDrawer>
        </AppDrawer>
      </MantineProvider>,
    )

    fireEvent.pointerDown(await screen.findByLabelText('inner field'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(closeInner).toHaveBeenCalledOnce()
    expect(closeOuter).not.toHaveBeenCalled()
  })

  it('leaves an Escape from the page body to a modal open above the sheet', async () => {
    const closeDrawer = vi.fn()
    render(
      <MantineProvider>
        <AppDrawer opened title="Обробка перепродажу" onClose={closeDrawer}>
          <Modal opened title="Закрити без перерахунку?" onClose={vi.fn()}>
            <div>Confirm body</div>
          </Modal>
        </AppDrawer>
      </MantineProvider>,
    )

    await screen.findByText('Confirm body')
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(closeDrawer).not.toHaveBeenCalled()
  })

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
    ).toBe('min(1200px, calc(100vw - 16px))')
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
    ).toBe('min(560px, calc(100vw - 16px))')
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
