import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AutomaticActionFixture } from './fixtures/AutomaticActionFixture'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

// This fixture is ordinary application JSX. The same Vite plugin used in production
// adds protection; none of these buttons or forms imports a guard or hook.
describe('automatic JSX action protection', () => {
  it.each(['Native', 'Mantine', 'Run icon action', 'Nested void', 'Spread', 'Menu action'])('protects %s without manual setup', async label => {
    const request = deferred(), work = vi.fn(() => request.promise), after = vi.fn()
    render(<AutomaticActionFixture work={work} after={after} />)
    const button = screen.getByRole(label === 'Menu action' ? 'menuitem' : 'button', { name: label })
    act(() => { for (let index = 0; index < 10; index += 1) fireEvent.click(button) })
    expect(work).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => { request.resolve(); await request.promise })
    expect(button.hasAttribute('data-ui-action-pending')).toBe(false)
    if (label === 'Native') expect(after).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(button) })
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('keeps the lock across a React rerender', async () => {
    const request = deferred(), work = vi.fn(() => request.promise)
    render(<AutomaticActionFixture work={work} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rerender 0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rerender 1' }))
    expect(work).toHaveBeenCalledTimes(1)
    await act(async () => { request.resolve(); await request.promise })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rerender 1' })) })
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('blocks repeated submits and external submit buttons without disabling form values or cancel', async () => {
    const request = deferred(), work = vi.fn(() => request.promise), after = vi.fn()
    render(<AutomaticActionFixture work={work} after={after} />)
    const form = screen.getByRole('form', { name: 'Editor' }) as HTMLFormElement
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    for (let index = 0; index < 10; index += 1) fireEvent.submit(form)
    fireEvent.click(screen.getByRole('button', { name: 'External submit' }))
    expect(work).toHaveBeenCalledTimes(1)
    expect(new FormData(form).get('value')).toBe('retained')
    expect((screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(after).toHaveBeenCalledOnce()
    await act(async () => { request.resolve(); await request.promise })
    await act(async () => { fireEvent.submit(form) })
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('does not throttle synchronous controls or block independent buttons', async () => {
    const request = deferred(), work = vi.fn(() => request.promise)
    render(<AutomaticActionFixture work={work} />)
    fireEvent.click(screen.getByRole('button', { name: 'Native' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync 0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync 1' }))
    expect(screen.getByRole('button', { name: 'Sync 2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mantine' }))
    expect(work).toHaveBeenCalledTimes(2)
    await act(async () => { request.resolve(); await request.promise })
  })

  it('waits for all discarded tasks, not just the first request', async () => {
    const first = deferred(), second = deferred(), work = vi.fn(() => first.promise), other = vi.fn(() => second.promise)
    render(<AutomaticActionFixture work={work} other={other} />)
    const button = screen.getByRole('button', { name: 'Parallel' })
    fireEvent.click(button)
    await act(async () => { first.resolve(); await first.promise })
    fireEvent.click(button)
    expect(work).toHaveBeenCalledTimes(1)
    expect(other).toHaveBeenCalledTimes(1)
    await act(async () => { second.resolve(); await second.promise })
    expect(button.hasAttribute('aria-busy')).toBe(false)
  })
})
