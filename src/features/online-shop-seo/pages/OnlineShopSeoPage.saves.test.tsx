import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SeoLocaleEntry } from '../types'
import { OnlineShopSeoPage } from './OnlineShopSeoPage'

const api = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  createSeoContact: vi.fn(),
  getSettings: vi.fn(),
  showNotification: vi.fn(),
  updateSeoContactInfo: vi.fn(),
  updateSeoPage: vi.fn(),
  uploadSeoContactImage: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: api.showNotification } }))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: api.canMock,
    cannot: (permissionKey: string) => !api.canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/onlineShopSeoApi', () => ({
  addEcommerceStorage: vi.fn(),
  createSeoContact: api.createSeoContact,
  getAllOnlineShopStorages: vi.fn().mockResolvedValue([]),
  getEcommerceStorages: vi.fn().mockResolvedValue([]),
  getOnlineShopClients: vi.fn().mockResolvedValue([]),
  getOnlineShopPaymentRegisters: vi.fn().mockResolvedValue([]),
  getOnlineShopSeoSettings: api.getSettings,
  removeEcommerceStorage: vi.fn(),
  removeSeoContact: vi.fn(),
  selectOnlineShopPaymentRegister: vi.fn(),
  toggleOnlineShopClient: vi.fn(),
  updateEcommerceStoragePriority: vi.fn(),
  updateSeoContact: vi.fn(),
  updateSeoContactInfo: api.updateSeoContactInfo,
  updateSeoPage: api.updateSeoPage,
  updateSeoPaymentInfo: vi.fn(),
  uploadSeoContactImage: api.uploadSeoContactImage,
}))

function makeSettings(contactInfo: SeoLocaleEntry['settings']['EcommerceContactInfo']): SeoLocaleEntry[] {
  return [{
    locale: 'uk',
    settings: {
      EcommerceContactInfo: contactInfo,
      EcommerceContactsList: [],
      EcommercePages: [{ Locale: 'uk', NetUid: 'page-id', PageName: 'Каталог', Title: 'Каталог', Url: '/catalog' }],
      RetailPaymentTypeTranslate: null,
    },
  }]
}

function renderPage(path: string, allowed: string[]) {
  const permissions = new Set([PermissionKeys.OnlineShopSeo.Page.View, ...allowed])
  api.canMock.mockImplementation((permissionKey) => permissions.has(permissionKey))

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

async function openContactInfoEditor() {
  renderPage('/online-shop-seo/info-payment', [PermissionKeys.OnlineShopSeo.GeneralInfo.Edit])
  fireEvent.click(await screen.findByRole('button', { name: 'Редагувати uk' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.getSettings.mockResolvedValue(makeSettings(null))
})

describe('SEO contact info', () => {
  it('limits fields to the DB column sizes and blocks javascript:, bad phone and bad e-mail', async () => {
    const dialog = await openContactInfoEditor()
    const siteUrl = within(dialog).getByRole('textbox', { name: 'Site URL' })

    expect(within(dialog).getByRole('textbox', { name: 'Адреса' }).getAttribute('maxlength')).toBe('250')
    expect(siteUrl.getAttribute('maxlength')).toBe('200')
    fireEvent.change(siteUrl, { target: { value: 'javascript:alert(1)' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Телефон' }), { target: { value: 'abc' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'E-mail' }), { target: { value: 'not-an-email' } })
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Зберегти' })[0])

    expect(await within(dialog).findByText('Site URL має починатися з http:// або https://')).toBeTruthy()
    expect(within(dialog).getByText('Вкажіть коректний e-mail')).toBeTruthy()
    expect(api.updateSeoContactInfo).not.toHaveBeenCalled()
  })

  it('stores Pixel ID with the single first save', async () => {
    api.updateSeoContactInfo
      .mockResolvedValueOnce(makeSettings({ Locale: 'uk', NetUid: 'new-info', PixelId: 'PX-1', SiteUrl: 'https://shop.test' }))
    const dialog = await openContactInfoEditor()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Site URL' }), { target: { value: 'https://shop.test' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Pixel ID' }), { target: { value: 'PX-1' } })
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Зберегти' })[0])

    await waitFor(() => {
      expect(api.showNotification).toHaveBeenCalledWith(expect.objectContaining({ message: 'Контактну інформацію оновлено' }))
    })
    expect(api.updateSeoContactInfo).toHaveBeenCalledTimes(1)
    expect(api.updateSeoContactInfo.mock.calls[0]?.[0]).not.toHaveProperty('NetUid')
    expect(api.updateSeoContactInfo.mock.calls[0]?.[0]).toMatchObject({ Locale: 'uk', PixelId: 'PX-1' })
  })
})

describe('SEO dialogs stay cancellable', () => {
  it('keeps Скасувати enabled while the contact save is pending and aborts it', async () => {
    let signal: AbortSignal | undefined
    api.createSeoContact.mockImplementation((_contact: unknown, nextSignal?: AbortSignal) => {
      signal = nextSignal
      return new Promise((_resolve, reject) => {
        nextSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    renderPage('/online-shop-seo/contacts', [PermissionKeys.OnlineShopSeo.Contact.Create])
    fireEvent.click(await screen.findByRole('button', { name: 'Новий контакт' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Прізвище' }), { target: { value: 'Тестовий' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Телефон' }), { target: { value: '0991234567' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'E-mail' }), { target: { value: 'contact@example.test' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => { expect(api.createSeoContact).toHaveBeenCalledTimes(1) })
    const cancel = within(dialog).getByRole('button', { name: 'Скасувати' }) as HTMLButtonElement

    expect(cancel.disabled).toBe(false)
    fireEvent.click(cancel)
    expect(signal?.aborted).toBe(true)
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
    expect(api.showNotification).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }))
  })

  it('ends a failed save with an error toast', async () => {
    api.updateSeoContactInfo.mockRejectedValue(new Error('Сервер недоступний'))
    const dialog = await openContactInfoEditor()

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Зберегти' })[0])

    await waitFor(() => {
      expect(api.showNotification).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Сервер недоступний' }))
    })
  })
})

describe('SEO contact photo', () => {
  it('rejects a fake image and uploads a real one only after the form validates', async () => {
    api.createSeoContact.mockResolvedValue(makeSettings(null))
    api.uploadSeoContactImage.mockResolvedValue('/Data/Seo/Contacts/photo.png')
    const { container } = renderPage('/online-shop-seo/contacts', [PermissionKeys.OnlineShopSeo.Contact.Create])
    fireEvent.click(await screen.findByRole('button', { name: 'Новий контакт' }))
    const dialog = await screen.findByRole('dialog')
    const fileInput = (dialog.ownerDocument || container).querySelector('input[type="file"]') as HTMLInputElement

    expect(fileInput.getAttribute('accept')).toBe('image/png,image/jpeg,image/gif,image/webp')

    fireEvent.change(fileInput, { target: { files: [new File(['text'], 'fake.png', { type: 'image/png' })] } })
    expect(await within(dialog).findByText('Оберіть зображення PNG, JPEG, GIF або WEBP')).toBeTruthy()

    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [png] } })
    await waitFor(() => { expect(within(dialog).queryByText('Оберіть зображення PNG, JPEG, GIF або WEBP')).toBeNull() })

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Прізвище' }), { target: { value: 'Тестовий' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    expect(await within(dialog).findByText('Вкажіть телефон контакту')).toBeTruthy()
    expect(api.uploadSeoContactImage).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Телефон' }), { target: { value: '+38 099 123 45 67' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'E-mail' }), { target: { value: 'contact@example.test' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => { expect(api.createSeoContact).toHaveBeenCalledTimes(1) })
    expect(api.uploadSeoContactImage).toHaveBeenCalledTimes(1)
    expect(api.createSeoContact.mock.calls[0]?.[0]).toMatchObject({ ImgUrl: '/Data/Seo/Contacts/photo.png' })
  })
})
