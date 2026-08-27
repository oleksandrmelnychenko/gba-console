import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addEcommerceStorage,
  getAllOnlineShopStorages,
  getEcommerceStorages,
  getOnlineShopClients,
  getOnlineShopPaymentRegisters,
  removeEcommerceStorage,
  selectOnlineShopPaymentRegister,
  toggleOnlineShopClient,
  updateEcommerceStoragePriority,
  uploadSeoContactImage,
} from './onlineShopSeoApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('online shop SEO permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses page-scoped read routes', async () => {
    await getOnlineShopClients()
    await getOnlineShopPaymentRegisters()
    await getEcommerceStorages()
    await getAllOnlineShopStorages()

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/clients/online-shop-seo/all/shop',
      '/payments/registers/online-shop-seo/all/retail',
      '/storages/online-shop-seo/all/ecommerce',
      '/storages/online-shop-seo/all',
    ])
  })

  it('uses one canonical mutation route per business action', async () => {
    await toggleOnlineShopClient('client-id')
    await selectOnlineShopPaymentRegister('register-id')
    await addEcommerceStorage('storage-id')
    await removeEcommerceStorage('storage-id')
    await updateEcommerceStoragePriority(17, 3)

    expect(apiRequestMock.mock.calls).toEqual([
      ['/clients/online-shop-seo/retail/set', { method: 'POST', query: { netId: 'client-id' } }],
      ['/payments/registers/online-shop-seo/select', { method: 'POST', query: { netId: 'register-id' } }],
      ['/storages/online-shop-seo/ecommerce/set', { method: 'POST', query: { netId: 'storage-id' } }],
      ['/storages/online-shop-seo/ecommerce/unselect', { method: 'POST', query: { netId: 'storage-id' } }],
      ['/storages/online-shop-seo/priority', { method: 'POST', query: { priority: 3, storageId: 17 } }],
    ])
  })

  it('does not create a technical image-upload permission separate from create or edit', async () => {
    apiRequestMock.mockResolvedValue('image-url')
    const image = new File(['x'], 'contact.png', { type: 'image/png' })

    await expect(uploadSeoContactImage(image, 'create')).resolves.toBe('image-url')
    await expect(uploadSeoContactImage(image, 'edit')).resolves.toBe('image-url')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/seo/info/contacts/create/img/add',
      '/seo/info/contacts/edit/img/add',
    ])
    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect(apiRequestMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
    expect(apiRequestMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
  })
})
