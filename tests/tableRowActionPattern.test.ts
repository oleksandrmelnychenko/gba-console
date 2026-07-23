import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import postcss from 'postcss'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const FORBIDDEN_ACTION_PROPS = new Set([
  'className',
  'color',
  'data-disabled',
  'icon',
  'radius',
  'size',
  'style',
  'styles',
  'title',
  'variant',
])

describe('table row action pattern', () => {
  it('routes interactive icon controls in table cells through TableRowAction', () => {
    const violations: string[] = []

    for (const filePath of sourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(filePath, 'utf8')
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )

      visitWithAncestors(sourceFile, (node, ancestors) => {
        if (!isJsxTag(node, 'ActionIcon') || !isInteractiveActionIcon(node, ancestors, sourceFile)) {
          return
        }

        const isTableCell = ancestors.some((ancestor) => (
          isPropertyNamed(ancestor, 'cell', sourceFile) ||
          (ts.isJsxElement(ancestor) && jsxTagName(ancestor.openingElement.tagName) === 'Table.Td')
        ))

        if (!isTableCell || isAllowedStructuralToggle(filePath, node, sourceFile)) {
          return
        }

        violations.push(location(filePath, node, sourceFile))
      })
    }

    expect(violations).toEqual([])
  })

  it('keeps row actions semantic and free of local visual overrides', () => {
    const violations: string[] = []

    for (const filePath of sourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(filePath, 'utf8')
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )

      visitWithAncestors(sourceFile, (node) => {
        if (!isJsxTag(node, 'TableRowAction')) {
          return
        }

        const attributes = jsxAttributes(node)
        const forbidden = [...attributes.keys()].filter((name) => FORBIDDEN_ACTION_PROPS.has(name))

        if (!attributes.has('action') || !attributes.has('label') || forbidden.length > 0) {
          violations.push(
            `${location(filePath, node, sourceFile)}${forbidden.length ? ` (${forbidden.join(', ')})` : ''}`,
          )
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('uses the native title from TableRowAction instead of per-cell Tooltip instances', () => {
    const violations: string[] = []

    for (const filePath of sourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(filePath, 'utf8')
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )

      visitWithAncestors(sourceFile, (node) => {
        if (!ts.isJsxElement(node) || jsxTagName(node.openingElement.tagName) !== 'Tooltip') {
          return
        }

        if (containsJsxTag(node, 'TableRowAction')) {
          violations.push(location(filePath, node, sourceFile))
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('does not let feature CSS restyle ActionIcon controls inside rows', () => {
    const visualProperties = new Set([
      'background',
      'background-color',
      'border',
      'border-color',
      'border-radius',
      'color',
      'height',
      'min-height',
      'min-width',
      'width',
    ])
    const violations: string[] = []

    for (const filePath of filesWithExtension(SOURCE_ROOT, '.css')) {
      const normalized = relative(process.cwd(), filePath).replaceAll('\\', '/')
      if (normalized.startsWith('src/shared/ui/table-row-action/')) {
        continue
      }

      const root = postcss.parse(readFileSync(filePath, 'utf8'), { from: filePath })

      root.walkRules((rule) => {
        if (!rule.selector.includes('.mantine-ActionIcon-root') || !rule.selector.includes('row')) {
          return
        }

        const declarations = rule.nodes
          .filter((node): node is postcss.Declaration => node.type === 'decl')
          .filter((declaration) => visualProperties.has(declaration.prop))
          .map((declaration) => declaration.prop)

        if (declarations.length > 0) {
          violations.push(`${normalized}:${rule.source?.start?.line ?? 1} (${declarations.join(', ')})`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})

function sourceFiles(directory: string): string[] {
  return filesWithExtension(directory, '.tsx')
}

function filesWithExtension(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return filesWithExtension(entryPath, extension)
    }

    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : []
  })
}

function visitWithAncestors(
  sourceFile: ts.SourceFile,
  visitor: (node: ts.Node, ancestors: ts.Node[]) => void,
) {
  const ancestors: ts.Node[] = []

  function visit(node: ts.Node) {
    visitor(node, ancestors)
    ancestors.push(node)
    ts.forEachChild(node, visit)
    ancestors.pop()
  }

  visit(sourceFile)
}

function isJsxTag(
  node: ts.Node,
  expectedName: string,
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return (
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
    jsxTagName(node.tagName) === expectedName
  )
}

function jsxTagName(tagName: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(tagName)) {
    return tagName.text
  }

  if (ts.isPropertyAccessExpression(tagName)) {
    return `${jsxTagName(tagName.expression as ts.JsxTagNameExpression)}.${tagName.name.text}`
  }

  return tagName.getText()
}

function jsxAttributes(node: ts.JsxOpeningLikeElement): Map<string, ts.JsxAttribute> {
  const attributes = new Map<string, ts.JsxAttribute>()

  for (const attribute of node.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) {
      attributes.set(attribute.name.getText(), attribute)
    }
  }

  return attributes
}

function isInteractiveActionIcon(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  ancestors: ts.Node[],
  sourceFile: ts.SourceFile,
): boolean {
  const attributes = jsxAttributes(node)

  return (
    attributes.has('onClick') ||
    attributes.has('component') ||
    ancestors.some((ancestor) => (
      ts.isJsxElement(ancestor) &&
      jsxTagName(ancestor.openingElement.tagName) === 'Menu.Target'
    )) ||
    ancestors.some((ancestor) => isPropertyNamed(ancestor, 'onClick', sourceFile))
  )
}

function isPropertyNamed(node: ts.Node, name: string, sourceFile: ts.SourceFile): boolean {
  return (
    (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) &&
    node.name.getText(sourceFile).replaceAll(/['"]/g, '') === name
  )
}

function containsJsxTag(node: ts.Node, expectedName: string): boolean {
  let found = false

  function visit(child: ts.Node) {
    if (isJsxTag(child, expectedName)) {
      found = true
      return
    }

    if (!found) {
      ts.forEachChild(child, visit)
    }
  }

  ts.forEachChild(node, visit)
  return found
}

function isAllowedStructuralToggle(
  filePath: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
): boolean {
  const normalized = relative(process.cwd(), filePath).replaceAll('\\', '/')
  const source = node.getText(sourceFile)

  return (
    (
      normalized === 'src/shared/ui/data-table/DataTableBody.tsx' &&
      source.includes('data-table-expand-toggle')
    ) ||
    (
      normalized === 'src/features/client-product-movement/pages/ClientProductMovementPage.tsx' &&
      source.includes("t('Згорнути')") &&
      source.includes("t('Розгорнути')")
    )
  )
}

function location(filePath: string, node: ts.Node, sourceFile: ts.SourceFile): string {
  const normalized = relative(process.cwd(), filePath).replaceAll('\\', '/')
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  return `${normalized}:${line}`
}
