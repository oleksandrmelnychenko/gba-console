import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { resetSystemOfRecordCutoverForTests } from '../../../shared/system-of-record/systemOfRecordCutover'
import { HeaderActionBar } from './HeaderActionBar'

const granted = vi.hoisted(() => new Set<string>())

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => granted.has(key) }),
}))
vi.mock('../../ai-fleet/components/AiFleetControl', () => ({
  AiFleetControl: () => <button type="button">AI флот</button>,
}))
vi.mock('./ProductWriteOffRulesControl', () => ({
  ProductWriteOffRulesControl: () => <button type="button">Глобальні правила списання</button>,
}))
vi.mock('./ResaleControl', () => ({ ResaleControl: () => null }))
vi.mock('./SyncControl', () => ({ SyncControl: () => null }))
vi.mock('../../onec-export/components/OneCExportControl', () => ({ OneCExportControl: () => null }))

function renderBar() {
  return render(
    <MantineProvider>
      <HeaderActionBar />
    </MantineProvider>,
  )
}

describe('header read controls', () => {
  beforeEach(() => {
    granted.clear()
    resetSystemOfRecordCutoverForTests({ cutoverUtc: null, isActive: false, loaded: true })
  })

  it('hides AI fleet and write-off rules without their keys', () => {
    granted.add(PermissionKeys.SystemPages.Dashboard.View)
    renderBar()

    expect(screen.queryByRole('button', { name: 'AI флот' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Глобальні правила списання' })).toBeNull()
  })

  it('shows AI fleet with dashboard.ai_fleet.view', () => {
    granted.add(PermissionKeys.Operational.AiFleet.View)
    renderBar()

    expect(screen.getByRole('button', { name: 'AI флот' })).toBeTruthy()
  })
})
