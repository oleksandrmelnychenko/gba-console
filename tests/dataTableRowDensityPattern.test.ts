import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { cwd } from 'node:process'
import postcss, { type Root, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const SHARED_TABLE_CSS = 'src/shared/ui/data-table/data-table.css'
const ROW_HEIGHT_VARIABLE = '--data-table-row-height'
const ROW_GEOMETRY_PROPERTIES = new Set(['height', 'max-height', 'min-height'])
const CELL_GEOMETRY_PROPERTIES = new Set([
  'font-size',
  'height',
  'line-height',
  'max-height',
  'min-height',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-top',
])

describe('shared DataTable body-row density contract', () => {
  it('maps compact and normal density to the canonical body-row heights', () => {
    const root = parseCss(SHARED_TABLE_CSS)
    const compactRoot = findRule(root, '.data-table-density-compact')
    const normalRoot = findRule(root, '.data-table-density-normal')
    const bodyRow = findRule(root, '.data-table-row')

    expect(declarations(compactRoot)).toMatchObject({ [ROW_HEIGHT_VARIABLE]: '35px' })
    expect(declarations(normalRoot)).toMatchObject({ [ROW_HEIGHT_VARIABLE]: '45px' })
    expect(declarations(bodyRow)).toMatchObject({ height: `var(${ROW_HEIGHT_VARIABLE})` })
  })

  it('keeps body-row and cell geometry out of feature CSS', () => {
    const violations: string[] = []

    for (const cssPath of findCssFiles(join(cwd(), 'src/features'))) {
      const root = postcss.parse(readFileSync(cssPath, 'utf8'), { from: cssPath })

      root.walkRules((rule) => {
        const targetsRow = rule.selectors.some((selector) => targetsClass(selector, 'data-table-row'))
        const targetsCell = rule.selectors.some((selector) => targetsClass(selector, 'data-table-cell'))

        if (!targetsRow && !targetsCell) {
          return
        }

        rule.walkDecls((declaration) => {
          const forbidden =
            (targetsRow && ROW_GEOMETRY_PROPERTIES.has(declaration.prop)) ||
            (targetsCell && CELL_GEOMETRY_PROPERTIES.has(declaration.prop))

          if (forbidden) {
            const sourceLine = declaration.source?.start?.line ?? rule.source?.start?.line ?? 1
            violations.push(
              `${relative(cwd(), cssPath)}:${sourceLine} ${rule.selector} { ${declaration.prop}: ${declaration.value} }`,
            )
          }
        })
      })
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})

function parseCss(cssPath: string): Root {
  return postcss.parse(readFileSync(join(cwd(), cssPath), 'utf8'), { from: cssPath })
}

function findRule(root: Root, selector: string): Rule {
  let match: Rule | undefined

  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      match = rule
    }
  })

  expect(match, `Missing CSS rule for ${selector}`).toBeDefined()
  return match as Rule
}

function declarations(rule: Rule): Record<string, string> {
  const result: Record<string, string> = {}

  rule.walkDecls((declaration) => {
    result[declaration.prop] = declaration.value
  })

  return result
}

function findCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return findCssFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : []
  })
}

function targetsClass(selector: string, className: string): boolean {
  return new RegExp(`\\.${className}(?![\\w-])`).test(selector)
}
