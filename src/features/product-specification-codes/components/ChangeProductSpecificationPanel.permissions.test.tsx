import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { changeProductSpecification } from '../api/productSpecificationCodesApi'
import type { ProductSpecification } from '../types'
import { ChangeProductSpecificationPanel } from './ChangeProductSpecificationPanel'

const allowedPermissions = new Set<string>()
const specification = {
  Id: 1,
  NetUid: '11111111-1111-4111-8111-111111111111',
  SpecificationCode: '8708',
  Product: { VendorCode: 'A-1' },
} satisfies ProductSpecification

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/productSpecificationCodesApi', () => ({
  changeProductSpecification: vi.fn(),
}))

describe('ChangeProductSpecificationPanel permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(changeProductSpecification).mockResolvedValue(null)
  })

  it('rechecks code.edit immediately before the mutation', async () => {
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Code.Edit)
    render(
      <MantineProvider>
        <I18nProvider>
          <ChangeProductSpecificationPanel
            productSpecification={specification}
            onChanged={vi.fn()}
            onClose={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.change(screen.getByLabelText(/Підтвердіть митний код/), { target: { value: '8708' } })
    const submit = screen.getByRole('button', { name: 'Змінити' })

    allowedPermissions.delete(PermissionKeys.ProductSpecificationCodes.Code.Edit)
    fireEvent.click(submit)
    expect(changeProductSpecification).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Code.Edit)
    fireEvent.click(submit)
    await waitFor(() => expect(changeProductSpecification).toHaveBeenCalledTimes(1))
  })
})
