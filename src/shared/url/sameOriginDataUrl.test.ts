import { afterEach, describe, expect, it, vi } from 'vitest'
import { toSameOriginDataUrl } from './sameOriginDataUrl'

describe('toSameOriginDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps empty urls safe for guarded anchors', () => {
    expect(toSameOriginDataUrl(undefined)).toBe('')
    expect(toSameOriginDataUrl(null)).toBe('')
    expect(toSameOriginDataUrl('  ')).toBe('')
  })

  it('opens a customer TTN through the console origin so the session cookie is sent', () => {
    expect(toSameOriginDataUrl('http://localhost:35981/Data/Temp/CustomersTTN-0123abcd.pdf'))
      .toBe('/Data/Temp/CustomersTTN-0123abcd.pdf')
    expect(toSameOriginDataUrl('https://api.example.com/Data/Temp/CustomersTTN-0123abcd.png'))
      .toBe('/Data/Temp/CustomersTTN-0123abcd.png')
  })

  it('keeps the query string and fragment of a signed document link', () => {
    expect(toSameOriginDataUrl('https://api.example.com/Data/Reports/a.xlsx?exp=1&sig=x#p'))
      .toBe('/Data/Reports/a.xlsx?exp=1&sig=x#p')
  })

  it('leaves relative /Data paths and foreign urls alone', () => {
    expect(toSameOriginDataUrl('/Data/Temp/CustomersTTN-1.pdf')).toBe('/Data/Temp/CustomersTTN-1.pdf')
    expect(toSameOriginDataUrl('https://novaposhta.ua/tracking/1')).toBe('https://novaposhta.ua/tracking/1')
    expect(toSameOriginDataUrl('https://api.example.com/Database/x.pdf')).toBe('https://api.example.com/Database/x.pdf')
  })

  it('upgrades a foreign http url on an https console', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } })

    expect(toSameOriginDataUrl('http://example.com/file.pdf')).toBe('https://example.com/file.pdf')
  })
})
