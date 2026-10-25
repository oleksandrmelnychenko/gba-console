import { MantineProvider } from '@mantine/core'
import { act, render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'

const identity = vi.hoisted(() => vi.fn())
vi.mock('./wizardClientStepApi', async importOriginal => ({
  ...await importOriginal<typeof import('./wizardClientStepApi')>(),
  getWizardClientIdentityAttention: identity,
}))
beforeEach(() => identity.mockReset().mockResolvedValue(null))

function view(id: string, controlled = false) {
  return <MantineProvider><I18nProvider><WizardClientHeroHeader
    client={{ NetUid: id, FullName: id }} agreements={[]} debts={[]} registryCount={0}
    {...(controlled ? { identityAttention: null } : {})}
  /></I18nProvider></MantineProvider>
}

it('does not independently request identity attention while the first step owns its loading', async () => {
  const { rerender } = render(view('client-1', true))
  rerender(view('client-2', true))
  await act(async () => {})
  expect(identity).not.toHaveBeenCalled()
})

it('still loads standalone headers and aborts retired requests', async () => {
  const { rerender, unmount } = render(view('client-1'))
  const first = identity.mock.calls[0][1] as AbortSignal
  rerender(view('client-2'))
  expect(first.aborted).toBe(true)
  expect(identity).toHaveBeenCalledTimes(2)
  const second = identity.mock.calls[1][1] as AbortSignal
  unmount()
  expect(second.aborted).toBe(true)
  await act(async () => {})
})
