import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OnlineShopSeoPage } from './OnlineShopSeoPage'

const {
  canMock,
  createContactMock,
  getAllStoragesMock,
  getClientsMock,
  getPaymentRegistersMock,
  getSeoSettingsMock,
  getStoragesMock,
  removeContactMock,
  updateContactMock,
  updatePageMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  createContactMock: vi.fn(),
  getAllStoragesMock: vi.fn(),
  getClientsMock: vi.fn(),
  getPaymentRegistersMock: vi.fn(),
  getSeoSettingsMock: vi.fn(),
  getStoragesMock: vi.fn(),
  removeContactMock: vi.fn(),
  updateContactMock: vi.fn(),
  updatePageMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/onlineShopSeoApi', () => ({
  addEcommerceStorage: vi.fn(),
  createSeoContact: createContactMock,
  getAllOnlineShopStorages: getAllStoragesMock,
  getEcommerceStorages: getStoragesMock,
  getOnlineShopClients: getClientsMock,
  getOnlineShopPaymentRegisters: getPaymentRegistersMock,
  getOnlineShopSeoSettings: getSeoSettingsMock,
  removeEcommerceStorage: vi.fn(),
  removeSeoContact: removeContactMock,
  selectOnlineShopPaymentRegister: vi.fn(),
  toggleOnlineShopClient: vi.fn(),
  updateEcommerceStoragePriority: vi.fn(),
  updateSeoContact: updateContactMock,
  updateSeoContactInfo: vi.fn(),
  updateSeoPage: updatePageMock,
  updateSeoPaymentInfo: vi.fn(),
  uploadSeoContactImage: vi.fn(),
}))

const settings = [{
  locale: 'uk',
  settings: {
    EcommerceContactInfo: { NetUid: 'info-id', Locale: 'uk' },
    EcommerceContactsList: [{
      Email: 'contact@example.test',
      FirstName: 'Іван',
      LastName: 'Тестовий',
      NetUid: 'contact-id',
      Phone: '+380000000000',
    }],
    EcommercePages: [{
      NetUid: 'page-id',
      Locale: 'uk',
      PageName: 'Каталог',
      Title: 'Каталог товарів',
      Url: '/catalog',
    }],
    RetailPaymentTypeTranslate: { NetUid: 'payment-id', CultureCode: 'uk' },
  },
}]

function renderPage(path: string, allowed: string[] = []) {
  const permissions = new Set([
    PermissionKeys.OnlineShopSeo.Page.View,
    ...allowed,
  ])
  canMock.mockImplementation((permissionKey) => permissions.has(permissionKey))

  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/online-shop-seo/:tab" element={<OnlineShopSeoPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('OnlineShopSeoPage business permissions', () => {
  beforeEach(() => {
    canMock.mockReset()
    getSeoSettingsMock.mockReset().mockResolvedValue(settings)
    getClientsMock.mockReset().mockResolvedValue([])
    getPaymentRegistersMock.mockReset().mockResolvedValue([])
    getStoragesMock.mockReset().mockResolvedValue([])
    getAllStoragesMock.mockReset().mockResolvedValue([])
    createContactMock.mockReset().mockResolvedValue(settings)
    updateContactMock.mockReset().mockResolvedValue(settings)
    removeContactMock.mockReset().mockResolvedValue(settings)
    updatePageMock.mockReset().mockResolvedValue(settings)
  })

  it('does not make a row click or edit icon a second SEO-page permission', async () => {
    const { unmount } = renderPage('/online-shop-seo/pages')

    expect(await screen.findByText('Каталог товарів')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    fireEvent.click(screen.getByText('Каталог товарів'))
    expect(screen.queryByText('Редагування SEO сторінки')).toBeNull()
    unmount()

    renderPage('/online-shop-seo/pages', [PermissionKeys.OnlineShopSeo.SeoPage.Edit])
    const edit = await screen.findByRole('button', { name: 'Редагувати' })
    fireEvent.click(edit)
    expect(await screen.findByText('Редагування SEO сторінки')).toBeTruthy()
  })

  it('keeps contact create, edit and delete as independent business permissions', async () => {
    const { unmount } = renderPage('/online-shop-seo/contacts', [PermissionKeys.OnlineShopSeo.Contact.Create])

    expect(await screen.findByRole('button', { name: 'Новий контакт' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    unmount()

    renderPage('/online-shop-seo/contacts', [
      PermissionKeys.OnlineShopSeo.Contact.Edit,
      PermissionKeys.OnlineShopSeo.Contact.Delete,
    ])
    await waitFor(() => expect(screen.getByText('contact@example.test')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Новий контакт' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Редагувати' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Видалити' })).toBeTruthy()
  })
})
