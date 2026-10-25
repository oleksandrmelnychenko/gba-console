import path from 'node:path'
import ts from 'typescript'

const eventNames = new Set(['onClick', 'onClickCapture', 'onDoubleClick', 'onDoubleClickCapture', 'onSubmit', 'onSubmitCapture'])

export function transformUiActions(code, filename, runtimePath) {
  let changed = false
  const result = ts.transpileModule(code, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      verbatimModuleSyntax: true,
      sourceMap: true,
      inlineSources: true,
    },
    transformers: { before: [context => source => {
      const factory = context.factory
      const imports = new Map()
      function call(name, expression) {
        changed = true
        if (!imports.has(name)) imports.set(name, factory.createUniqueName(`__${name}`))
        return factory.createCallExpression(imports.get(name), undefined, [expression])
      }
      function visit(original) {
        const node = ts.visitEachChild(original, visit, context)
        if (ts.isJsxAttribute(node) && eventNames.has(node.name.getText(source))
          && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          return factory.updateJsxAttribute(node, node.name,
            factory.updateJsxExpression(node.initializer, call('guardUiAction', node.initializer.expression)))
        }
        if (ts.isJsxSpreadAttribute(node)) {
          return factory.updateJsxSpreadAttribute(node, call('guardUiActionProps', node.expression))
        }
        if (ts.isVoidExpression(node)) {
          return factory.updateVoidExpression(node, call('trackUiActionResult', node.expression))
        }
        if (ts.isExpressionStatement(node) && (ts.isCallExpression(node.expression)
          || ts.isConditionalExpression(node.expression)
          || ts.isBinaryExpression(node.expression) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.expression.operatorToken.kind))) {
          return factory.updateExpressionStatement(node, call('trackUiActionResult', node.expression))
        }
        return node
      }
      const updated = ts.visitNode(source, visit)
      if (!imports.size) return source
      return factory.updateSourceFile(updated, [factory.createImportDeclaration(undefined,
        factory.createImportClause(false, undefined, factory.createNamedImports(
          Array.from(imports, ([name, alias]) => factory.createImportSpecifier(false, factory.createIdentifier(name), alias)),
        )), factory.createStringLiteral(runtimePath), undefined), ...updated.statements])
    }] },
  })
  return changed ? { code: result.outputText, map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null } : null
}

/** Apply equally in development, production and Vitest. Never instrument dependencies. */
export function uiActionGuardPlugin(root = process.cwd()) {
  const sourceRoot = path.resolve(root, 'src') + path.sep
  const runtimePath = path.resolve(sourceRoot, 'shared/ui/action-guard/uiActionGuard.ts')
  return {
    name: 'app-ui-action-guard',
    enforce: 'pre',
    transform(code, id) {
      const filename = id.split('?')[0]
      if (!filename.startsWith(sourceRoot) || !/\.[jt]sx?$/.test(filename)
        || filename === runtimePath || /\.(test|spec)\.[jt]sx?$/.test(filename)
        || filename.startsWith(path.join(sourceRoot, 'test') + path.sep)) return null
      return transformUiActions(code, filename, runtimePath)
    },
  }
}
