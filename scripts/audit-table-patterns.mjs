import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// Source inventory, not a claim of browser coverage. Include static tables in
// modals/expansions, not just DataTable imports in top-level page components.
const inventory = []
// This responsive grid has dynamic VAT/currency columns and editable discounts.
const customTables = new Set(['src/features/sales-ukraine/components/SaleExpandContent.tsx'])
for (const relative of fs.readdirSync('src', { recursive: true }).sort()) {
  if (!relative.endsWith('.tsx') || /\.(test|spec)\./.test(relative)) continue
  const file = path.join('src', relative)
  const source = fs.readFileSync(file, 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const tables = []
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(tree)
      const attribute = (name) => node.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name)?.initializer
      const role = attribute('role')
      const tableRole = role && ts.isStringLiteral(role) && ['table', 'grid'].includes(role.text)
      if (['DataTable', 'Table', 'table'].includes(tag) || tableRole) {
        const className = attribute('className')?.getText(tree) ?? ''
        const sharedImplementation = relative.startsWith('shared/ui/data-table/')
        const pattern = tag === 'DataTable' || sharedImplementation ? 'DataTable' : className.includes('app-static-table') ? 'static' : tableRole && customTables.has(file) ? 'reviewed-grid' : 'unclassified'
        tables.push({ line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, tag, pattern })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (tables.length) inventory.push({ file, tables })
}
const missing = inventory.flatMap(({ file, tables }) => tables.filter((table) => table.pattern === 'unclassified').map((table) => `${file}:${table.line}`))
if (process.argv.includes('--json')) console.log(JSON.stringify(inventory, null, 2))
else {
  const totals = inventory.flatMap((entry) => entry.tables).reduce((sum, table) => { sum[table.pattern] = (sum[table.pattern] ?? 0) + 1; return sum }, {})
  console.log(JSON.stringify({ files: inventory.length, ...totals, unclassified: missing }, null, 2))
}
if (process.argv.includes('--check') && missing.length) process.exitCode = 1
