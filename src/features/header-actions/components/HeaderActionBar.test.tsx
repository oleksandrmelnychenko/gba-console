import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetSystemOfRecordCutoverForTests } from '../../../shared/system-of-record/systemOfRecordCutover'
import { HeaderActionBar } from './HeaderActionBar'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))
vi.mock('../../ai-fleet/components/AiFleetControl', () => ({
  AiFleetControl: () => null,
}))
vi.mock('./ProductWriteOffRulesControl', () => ({
  ProductWriteOffRulesControl: () => null,
}))
vi.mock('./SyncControl', () => ({
  SyncControl: () => <button type="button">1С синхронізація</button>,
}))

function renderBar() {
  return render(
    <MantineProvider>
      <HeaderActionBar />
    </MantineProvider>,
  )
}

describe('header sync control after the cutover', () => {
  afterEach(() => {
    resetSystemOfRecordCutoverForTests()
  })

  it('shows the 1C sync control before the cutover', () => {
    resetSystemOfRecordCutoverForTests({ cutoverUtc: null, isActive: false, loaded: true })

    renderBar()

    expect(screen.getByRole('button', { name: '1С синхронізація' })).toBeTruthy()
  })

  it('hides the 1C sync control once GBA is the system of record', () => {
    resetSystemOfRecordCutoverForTests({ cutoverUtc: '2026-11-01T00:00:00Z', isActive: true, loaded: true })

    renderBar()

    expect(screen.queryByRole('button', { name: '1С синхронізація' })).toBeNull()
  })
})
