import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { HeaderActionBar } from './HeaderActionBar'

const granted = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => granted.has(key) }),
}))
vi.mock('../../ai-fleet/components/AiFleetControl', () => ({ AiFleetControl: () => null }))
vi.mock('./ProductWriteOffRulesControl', () => ({
  ProductWriteOffRulesControl: () => <button type="button">Глобальні правила списання</button>,
}))
vi.mock('./ResaleControl', () => ({ ResaleControl: () => null }))
vi.mock('./SyncControl', () => ({ SyncControl: () => null }))
vi.mock('../../onec-export/components/OneCExportControl', () => ({ OneCExportControl: () => null }))

function renderBar(keys: string[]) {
  granted.clear()
  keys.forEach((key) => granted.add(key))
  return render(
    <MantineProvider>
      <HeaderActionBar />
    </MantineProvider>,
  )
}

describe('header write-off rules button', () => {
  it('is hidden without products.assortment.write_off_rules.open', () => {
    renderBar([])

    expect(screen.queryByRole('button', { name: 'Глобальні правила списання' })).toBeNull()
  })

  it('is shown with the key', () => {
    renderBar([PermissionKeys.ProductsAssortment.WriteOffRules.Open])

    expect(screen.getByRole('button', { name: 'Глобальні правила списання' })).toBeTruthy()
  })
})
