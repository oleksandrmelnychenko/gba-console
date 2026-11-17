import { describe, expect, it } from 'vitest'
import { resolveSeoContactImageUrl } from './utils'

describe('SEO contact photo URL', () => {
  it('keeps a relative /Data/Seo path (what the server stores now)', () => {
    expect(resolveSeoContactImageUrl('/Data/Seo/Contacts/qa-1.png')).toBe('/Data/Seo/Contacts/qa-1.png')
  })

  it('serves older rows saved with another console origin through this origin', () => {
    expect(resolveSeoContactImageUrl('http://127.0.0.7:5176/Data/Seo/Contacts/qa-1.png')).toBe('/Data/Seo/Contacts/qa-1.png')
  })

  it('leaves external images and empty values alone', () => {
    expect(resolveSeoContactImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(resolveSeoContactImageUrl('')).toBeUndefined()
    expect(resolveSeoContactImageUrl(null)).toBeUndefined()
  })
})
