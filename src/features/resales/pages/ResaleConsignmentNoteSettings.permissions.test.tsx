import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getResaleConsignmentNoteSettings } from '../api/resalesApi'
import {
  RESALE_CONSIGNMENT_NOTE_PERMISSION,
  RESALE_CONSIGNMENT_NOTE_SETTING_SAVE_PERMISSION,
} from '../permissions'
import { ConsignmentNoteSettingsDrawer } from './ResalesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/resalesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/resalesApi')>(),
  getResaleConsignmentNoteSettings: vi.fn().mockResolvedValue([]),
}))

function renderDrawer() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ConsignmentNoteSettingsDrawer opened resale={null} onClose={() => {}} />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('resale consignment note settings', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    allowedPermissions.add(RESALE_CONSIGNMENT_NOTE_PERMISSION)
  })

  it('lets a print-only role print but not create or change saved settings', async () => {
    renderDrawer()

    await waitFor(() => expect(getResaleConsignmentNoteSettings).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Друк' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('shows the save action with the setting-save key', async () => {
    allowedPermissions.add(RESALE_CONSIGNMENT_NOTE_SETTING_SAVE_PERMISSION)
    renderDrawer()

    await waitFor(() => expect(getResaleConsignmentNoteSettings).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Створити' })).toBeTruthy()
  })
})
