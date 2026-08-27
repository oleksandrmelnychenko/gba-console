import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const styles = postcss.parse(readFileSync(join(
  cwd(),
  'src/features/sales-ukraine/components/new-sale-wizard/new-sale-wizard.css',
), 'utf8'))

function declarations(selector: string) {
  const result: Record<string, string> = {}
  styles.walkRules(selector, (rule) => {
    rule.walkDecls((declaration) => {
      result[declaration.prop] = declaration.value
    })
  })
  return result
}

describe('wizard product photo preview', () => {
  it('hides the photo by default without changing layout or blocking other results', () => {
    expect(declarations('.new-sale-product-picker-card__media')).toMatchObject({
      'pointer-events': 'none',
      position: 'absolute',
      visibility: 'hidden',
    })
  })

  it('reveals the photo on hover and keyboard focus', () => {
    expect(declarations(
      '.new-sale-product-picker-card:is(:hover, :focus-visible) .new-sale-product-picker-card__media',
    )).toMatchObject({ visibility: 'visible' })
  })
})
