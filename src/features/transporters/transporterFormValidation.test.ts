import { describe, expect, it } from 'vitest'
import { validateTransporterForm } from './transporterFormValidation'

const base = { CssClass: 'nova-poshta', ImageFile: null, ImageUrl: '', Name: 'QA Перевізник', Priority: '1' }

describe('validateTransporterForm', () => {
  it('accepts a normal transporter', () => {
    expect(validateTransporterForm(base)).toBeNull()
  })

  it.each([
    [{ Priority: '99999999999999' }, 'Пріоритет — ціле число від 0 до 2 147 483 647'],
    [{ CssClass: '<b>x</b>' }, 'CSS клас може містити лише літери, цифри, пробіли, «-» та «_»'],
    [{ ImageUrl: 'javascript:alert(1)' }, 'URL зображення має починатися з http://, https:// або /'],
    [{ ImageFile: new File(['MZ'], 'evil.exe', { type: 'application/x-msdownload' }) }, 'Зображення має бути файлом PNG, JPEG, GIF або WEBP'],
  ])('names the field: %#', (patch, message) => {
    expect(validateTransporterForm({ ...base, ...patch })).toBe(message)
  })
})
