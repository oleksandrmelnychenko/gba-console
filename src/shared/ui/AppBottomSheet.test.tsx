import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppBottomSheet } from './AppBottomSheet'

describe('AppBottomSheet', () => {
  it('supports tap and keyboard detent controls', async () => {
    const onClose = vi.fn()

    render(
      <MantineProvider>
        <AppBottomSheet
          closeLabel="Close plan"
          collapseLabel="Collapse plan"
          expandLabel="Expand plan"
          opened
          title="Procurement plan"
          onClose={onClose}
        >
          <div>Table content</div>
        </AppBottomSheet>
      </MantineProvider>,
    )

    expect(await screen.findByRole('dialog', { name: 'Procurement plan' })).toBeTruthy()
    expect(document.querySelectorAll('.app-bottom-sheet')).toHaveLength(1)

    const expandHandle = await screen.findByRole('button', { name: 'Expand plan' })

    expect(expandHandle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(expandHandle)

    const collapseHandle = screen.getByRole('button', { name: 'Collapse plan' })

    expect(collapseHandle.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(collapseHandle, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: 'Expand plan' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Expand plan' }), { key: 'ArrowDown' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes after the handle region is dragged well below the medium detent', async () => {
    const onClose = vi.fn()

    render(
      <MantineProvider>
        <AppBottomSheet
          closeLabel="Close plan"
          collapseLabel="Collapse plan"
          expandLabel="Expand plan"
          opened
          title="Procurement plan"
          onClose={onClose}
        >
          <div>Table content</div>
        </AppBottomSheet>
      </MantineProvider>,
    )

    const handle = await screen.findByRole('button', { name: 'Expand plan' })

    fireEvent.pointerDown(handle, { button: 0, clientX: 20, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(document, { clientX: 20, clientY: 180, pointerId: 1 })
    fireEvent.pointerUp(document, { clientX: 20, clientY: 300, pointerId: 1 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
