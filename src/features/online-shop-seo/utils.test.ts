import { describe, expect, it } from 'vitest'

import {
  getContactInfoFieldErrors,
  validateContact,
  validatePriorityRange,
  validateSeoContactImage,
  validateSeoEmail,
  validateSeoPhone,
  validateSeoSiteUrl,
} from './utils'

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]

describe('SEO contact info validation', () => {
  it('accepts only absolute http(s) site URLs', () => {
    expect(validateSeoSiteUrl('')).toBeNull()
    expect(validateSeoSiteUrl('https://shop.example.test/uk')).toBeNull()
    expect(validateSeoSiteUrl('http://shop.example.test')).toBeNull()
    expect(validateSeoSiteUrl('javascript:alert(1)')).not.toBeNull()
    expect(validateSeoSiteUrl('data:text/html,<b>x</b>')).not.toBeNull()
    expect(validateSeoSiteUrl('shop.example.test')).not.toBeNull()
  })

  it('checks phone and e-mail formats', () => {
    expect(validateSeoPhone('+38 (099) 123-45-67')).toBeNull()
    expect(validateSeoPhone('0991234567')).toBeNull()
    expect(validateSeoPhone('abc')).not.toBeNull()
    expect(validateSeoPhone('+38(099)abc')).not.toBeNull()
    expect(validateSeoPhone('12345')).not.toBeNull()
    expect(validateSeoEmail('shop@example.test')).toBeNull()
    expect(validateSeoEmail('not-an-email')).not.toBeNull()
    expect(validateSeoEmail('bad@@mail')).not.toBeNull()
  })

  it('reports every invalid contact info field at once', () => {
    expect(getContactInfoFieldErrors({
      Address: 'вул. Тестова, 1',
      Email: 'not-an-email',
      Phone: 'abc',
      PixelId: '',
      SiteUrl: 'javascript:alert(1)',
    })).toEqual({
      Email: expect.any(String),
      Phone: expect.any(String),
      SiteUrl: expect.any(String),
    })
  })

  it('rejects malformed contact phone and e-mail', () => {
    const base = { Email: 'a@example.test', FirstName: 'Іван', ImgUrl: '', LastName: '', MiddleName: '', Phone: '0991234567' }

    expect(validateContact(base)).toBeNull()
    expect(validateContact({ ...base, Phone: '+38(099)abc' })).not.toBeNull()
    expect(validateContact({ ...base, Email: 'bad@@mail' })).not.toBeNull()
  })
})

describe('validatePriorityRange', () => {
  it('keeps the priority inside the SQL int range', () => {
    expect(validatePriorityRange('1')).toBeNull()
    expect(validatePriorityRange('2147483647')).toBeNull()
    expect(validatePriorityRange('2147483648')).toMatch(/2147483647/)
    expect(validatePriorityRange('99999999999')).not.toBeNull()
    expect(validatePriorityRange('1.5')).not.toBeNull()
    expect(validatePriorityRange('1e3')).not.toBeNull()
    expect(validatePriorityRange('')).not.toBeNull()
  })
})

describe('validateSeoContactImage', () => {
  it('accepts a real PNG', async () => {
    const file = new File([new Uint8Array(PNG_HEADER)], 'photo.png', { type: 'image/png' })

    expect(await validateSeoContactImage(file)).toBeNull()
  })

  it('rejects a text file renamed to .png and non-image MIME types', async () => {
    const fake = new File(['just some text'], 'fake.png', { type: 'image/png' })
    const svg = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' })

    expect(await validateSeoContactImage(fake)).not.toBeNull()
    expect(await validateSeoContactImage(svg)).not.toBeNull()
  })
})
