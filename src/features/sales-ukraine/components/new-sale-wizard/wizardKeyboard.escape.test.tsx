import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchWizardKey, resetWizardKeyboard, useWizardKeyHandler } from './wizardKeyboard'

function Wizard({ onEscape }: { onEscape: () => void }) {
  useWizardKeyHandler((event) => {
    if (event.hotkey === 'Escape') {
      onEscape()
      return true
    }
  })

  return (
    <div data-testid="wizard" onKeyDown={(event) => { dispatchWizardKey(event) }}>
      <input aria-label="wizard field" />
      {createPortal(<div role="dialog"><input aria-label="nested field" /></div>, document.body)}
    </div>
  )
}

afterEach(() => resetWizardKeyboard())

describe('wizard Escape with nested dialogs', () => {
  it('lets a portaled nested dialog keep its Escape and still handles Escape inside the wizard', () => {
    const onEscape = vi.fn()
    render(<Wizard onEscape={onEscape} />)

    fireEvent.keyDown(screen.getByLabelText('nested field'), { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByLabelText('wizard field'), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
  })
})
