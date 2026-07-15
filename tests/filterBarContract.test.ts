import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import postcss, { type Root, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const filterBarCss = readFileSync(join(cwd(), 'src/shared/ui/filter-bar.css'), 'utf8')
const featureStyles = readCssFiles(join(cwd(), 'src/features'))

const BAR_CLASS_PATTERN = /^(?:app-filter-bar|sales-filter-bar|console-table-command-bar|[\w-]+-filter-bar|[\w-]+-command-bar|assort-filter)$/
const FILTER_ROW_CLASS_PATTERN = /(?:filter-content|filter-form|filter-row)$/
const FIELD_GEOMETRY_SELECTOR_PATTERN = /mantine-(?:Input-wrapper|Input-input|InputWrapper-label|Select-input|TextInput-input)/
const CANONICAL_GEOMETRY_LITERALS = new Set(['4px', '17px', '36px'])
const FORBIDDEN_FEATURE_BAR_PROPERTIES = new Set([
  'height',
  'max-height',
  'min-height',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-inline',
  'padding-inline-end',
  'padding-inline-start',
  'padding-left',
  'padding-right',
  'padding-top',
])

describe('filter-bar CSS contract', () => {
  const root = postcss.parse(filterBarCss)

  it('owns the canonical 74px one-row geometry', () => {
    const tokenRule = findRule(root, '--app-filter-bar-height', ':root')
    const barRule = findRule(root, 'min-height', '.app-filter-bar', '.sales-filter-bar', '.console-table-command-bar')

    expect(declarations(tokenRule)).toMatchObject({
      '--app-filter-bar-height': '74px',
      '--app-filter-control-height': '36px',
      '--app-filter-label-gap': '4px',
      '--app-filter-label-height': '17px',
    })
    expect(declarations(barRule)).toMatchObject({
      'align-items': 'end',
      'box-sizing': 'border-box',
      gap: '10px',
      'min-height': 'var(--app-filter-bar-height)',
      padding: '8px',
    })
  })

  it('uses the same label and control slots for Mantine and compound fields', () => {
    const labelRule = findRule(
      root,
      'margin-bottom',
      '.app-filter-bar .mantine-InputWrapper-label',
      '.sales-filter-bar .mantine-InputWrapper-label',
      '.console-table-command-bar .mantine-InputWrapper-label',
    )
    const fieldRule = findRule(
      root,
      'grid-template-rows',
      '.app-filter-bar .app-filter-field',
      '.sales-filter-bar .app-filter-field',
      '.console-table-command-bar .app-filter-field',
    )
    const inputRule = findRule(
      root,
      'height',
      '.app-filter-bar .mantine-Input-input',
      '.sales-filter-bar .mantine-Input-input',
      '.console-table-command-bar .mantine-Input-input',
    )
    const scrollableRowRule = findRule(
      root,
      'padding-bottom',
      '.app-filter-bar .clients-filter-row',
      '.sales-filter-bar .clients-filter-row',
      '.console-table-command-bar .clients-filter-row',
    )

    expect(declarations(labelRule)).toMatchObject({
      display: 'block',
      height: 'var(--app-filter-label-height)',
      'margin-bottom': 'var(--app-filter-label-gap)',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    })
    expect(declarations(fieldRule)).toMatchObject({
      'grid-template-rows': 'var(--app-filter-label-height) var(--app-filter-control-height)',
      'row-gap': 'var(--app-filter-label-gap)',
    })
    expect(declarations(inputRule)).toMatchObject({
      height: 'var(--app-filter-control-height, 36px)',
      'min-height': 'var(--app-filter-control-height, 36px)',
    })
    expect(declarations(scrollableRowRule)).toMatchObject({
      'padding-bottom': '0',
    })
  })

  it('keeps vertical bar geometry out of feature styles', () => {
    const conflicts: string[] = []

    Object.entries(featureStyles).forEach(([file, css]) => {
      postcss.parse(css, { from: file }).walkRules((rule) => {
        if (!targetsFilterBar(rule) && !targetsFilterRow(rule)) {
          return
        }

        rule.walkDecls((declaration) => {
          if (FORBIDDEN_FEATURE_BAR_PROPERTIES.has(declaration.prop)) {
            conflicts.push(`${file}:${rule.source?.start?.line ?? 0} ${rule.selector} -> ${declaration.prop}`)
          }
        })
      })
    })

    expect(conflicts).toEqual([])
  })

  it('keeps field geometry tied to the shared tokens', () => {
    const conflicts: string[] = []

    Object.entries(featureStyles).forEach(([file, css]) => {
      postcss.parse(css, { from: file }).walkRules((rule) => {
        const isFilterFieldRule = containsFilterBarClass(rule) && FIELD_GEOMETRY_SELECTOR_PATTERN.test(rule.selector)
        const ownsFilterTokens = targetsFilterBar(rule) || targetsFilterRow(rule)

        rule.walkDecls((declaration) => {
          const redefinesToken = ownsFilterTokens
            && declaration.prop.startsWith('--')
            && CANONICAL_GEOMETRY_LITERALS.has(declaration.value)
          const hardCodesFieldGeometry = isFilterFieldRule
            && ['height', 'margin-bottom', 'max-height', 'min-height', 'row-gap'].includes(declaration.prop)
            && CANONICAL_GEOMETRY_LITERALS.has(declaration.value)

          if (redefinesToken || hardCodesFieldGeometry) {
            conflicts.push(`${file}:${rule.source?.start?.line ?? 0} ${rule.selector} -> ${declaration.prop}:${declaration.value}`)
          }
        })
      })
    })

    expect(conflicts).toEqual([])
  })
})

function findRule(root: Root, requiredProperty: string, ...selectors: string[]): Rule {
  let match: Rule | undefined

  root.walkRules((rule) => {
    const hasRequiredProperty = rule.nodes.some(
      (node) => node.type === 'decl' && node.prop === requiredProperty,
    )

    if (hasRequiredProperty && selectors.every((selector) => rule.selectors.includes(selector))) {
      match = rule
    }
  })

  expect(match, `Missing CSS rule for ${selectors.join(', ')} with ${requiredProperty}`).toBeDefined()
  return match as Rule
}

function declarations(rule: Rule): Record<string, string> {
  const result: Record<string, string> = {}

  rule.walkDecls((declaration) => {
    result[declaration.prop] = declaration.value
  })

  return result
}

function targetsFilterBar(rule: Rule): boolean {
  return targetClassNames(rule).some((className) => BAR_CLASS_PATTERN.test(className))
}

function targetsFilterRow(rule: Rule): boolean {
  return targetClassNames(rule).some((className) => FILTER_ROW_CLASS_PATTERN.test(className))
}

function containsFilterBarClass(rule: Rule): boolean {
  return rule.selectors.some((selector) => (
    [...selector.matchAll(/\.([\w-]+)/g)]
      .some((match) => BAR_CLASS_PATTERN.test(match[1]))
  ))
}

function targetClassNames(rule: Rule): string[] {
  return rule.selectors.flatMap((selector) => {
    const targetCompound = selector.trim().split(/[\s>+~]+/).filter(Boolean).at(-1) ?? ''

    return [...targetCompound.matchAll(/\.([\w-]+)/g)].map((match) => match[1])
  })
}

function readCssFiles(directory: string): Record<string, string> {
  const result: Record<string, string> = {}

  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      Object.assign(result, readCssFiles(entryPath))
    } else if (entry.name.endsWith('.css')) {
      result[entryPath] = readFileSync(entryPath, 'utf8')
    }
  })

  return result
}
