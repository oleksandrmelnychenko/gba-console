import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchWizardKey, resetWizardKeyboard, useWizardKeyHandler } from './wizardKeyboard'

function Wizard({ nested, onEscape }: { nested: boolean; onEscape: () => void }) {
  useWizardKeyHandler((event) => {
    if (event.hotkey === 'Escape') {
      onEscape()
      return true
    }
  })

  return (
    <div data-testid="wizard" onKeyDown={(event) => { dispatchWizardKey(event) }}>
      <input aria-label="wizard field" />
      {nested && createPortal(<div role="dialog"><input aria-label="nested field" /></div>, document.body)}
    </div>
  )
}

afterEach(() => resetWizardKeyboard())

describe('wizard Escape with nested dialogs', () => {
  it('lets a portaled nested dialog keep its Escape, also when focus stayed in the wizard', () => {
    const onEscape = vi.fn()
    render(<Wizard nested onEscape={onEscape} />)

    fireEvent.keyDown(screen.getByLabelText('nested field'), { key: 'Escape' })
    fireEvent.keyDown(screen.getByLabelText('wizard field'), { key: 'Escape' })

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('handles Escape inside the wizard when no nested dialog is open', () => {
    const onEscape = vi.fn()
    render(<Wizard nested={false} onEscape={onEscape} />)

    fireEvent.keyDown(screen.getByLabelText('wizard field'), { key: 'Escape' })

    expect(onEscape).toHaveBeenCalledOnce()
  })
})
