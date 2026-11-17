// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createProductEditForm } from './productEditForm'

describe('product edit form: description and notes', () => {
  it('starts from the localized (UA) text the card shows', () => {
    const form = createProductEditForm({
      Description: 'опис RU',
      DescriptionUA: 'опис UA',
      Notes: 'note RU',
      NotesUA: 'нотатка UA',
    } as Parameters<typeof createProductEditForm>[0])

    expect(form.Description).toBe('опис UA')
    expect(form.Notes).toBe('нотатка UA')
  })

  it('falls back to the base text when there is no UA copy', () => {
    const form = createProductEditForm({ Description: 'опис', Notes: 'note', NotesUA: null } as unknown as Parameters<typeof createProductEditForm>[0])

    expect(form.Description).toBe('опис')
    expect(form.Notes).toBe('note')
  })

  it('has no separate «Опис UA» / «Нотатки UA» inputs the server would drop', () => {
    const source = readFileSync('src/features/products/pages/ProductDetailPage.tsx', 'utf8') as string

    expect(source).not.toMatch(/label=\{t\('(Опис|Нотатки) UA'\)\}/)
    expect(source).toMatch(/DescriptionUA: form\.Description,/)
    expect(source).toMatch(/NotesUA: form\.Notes,/)
  })
})
