import { describe, expect, it } from 'vitest'
import { createEcommerceImageSearchNotification } from './ecommerceImageSearchNotification'

describe('createEcommerceImageSearchNotification', () => {
  it('maps a received photo into the AI image-search workspace', () => {
    expect(createEcommerceImageSearchNotification({
      CreatedAtUtc: '2026-07-31T10:45:00Z',
      IsAuthenticated: false,
      Locale: 'uk',
      NetUid: 'C2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      OriginalFileName: 'part.jpg',
      Status: 'processing',
    })).toEqual({
      createdAt: '2026-07-31T10:45:00.000Z',
      entityNetUid: 'C2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      id: 'ecommerce-ai-image-search:c2ab51be-bc27-4ef3-977d-b0ef1b9b731c',
      kind: 'ecommerce-ai-image-search',
      message: 'part.jpg · Анонімний відвідувач · UK',
      route: '/sales-online-shop?workspace=image-searches&imageSearch=C2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      title: 'Нове фото на AI-розпізнавання',
    })
  })

  it('ignores a malformed event without a persisted identifier', () => {
    expect(createEcommerceImageSearchNotification({ Status: 'processing' })).toBeNull()
  })
})
