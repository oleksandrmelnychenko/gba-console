import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const SCHEMA_VERSION = 1
const DEFAULT_OUTPUT = 'docs/event-permission-candidates.sales-ukraine.json'
const DEFAULT_ROUTE = '/sales/ukraine/all'
const DEFAULT_FILES = [
  'src/features/sales-ukraine/pages/SalesUkrainePage.tsx',
  'src/features/sales-ukraine/components/new-sale-wizard/NewSaleWizard.tsx',
  'src/features/sales-ukraine/components/new-sale-wizard/NewSaleReviewStep.tsx',
]
const ACTION_PROPS = new Map([
  ['onClick', 'button.click'],
  ['onContextMenu', 'context_menu.open'],
  ['onDoubleClick', 'row.double_click'],
  ['onRowClick', 'row.click'],
  ['onSubmit', 'form.submit'],
])
const LABEL_PROPS = ['aria-label', 'label', 'title']
const PERMISSION_CALLS = new Set(['can', 'hasPermission'])

export function scanSourceText({
  file = 'fixture.tsx',
  route = DEFAULT_ROUTE,
  sourceText,
}) {
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  return collectCandidates(sourceFile, undefined, route, normalizePath(file))
}

export function buildReport({
  root = process.cwd(),
  files = DEFAULT_FILES,
  route = DEFAULT_ROUTE,
} = {}) {
  const normalizedFiles = [...new Set(files.map(normalizePath))].sort(compareText)
  const absoluteFiles = normalizedFiles.map((file) => resolve(root, file))
  const missingFiles = absoluteFiles.filter((file) => !existsSync(file))

  if (missingFiles.length > 0) {
    throw new Error(
      `Audit input not found: ${missingFiles.map((file) => normalizePath(relative(root, file))).join(', ')}`,
    )
  }

  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.app.json')
  const options = configPath
    ? readCompilerOptions(configPath)
    : { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 }
  const program = ts.createProgram({ options, rootNames: absoluteFiles })
  const checker = program.getTypeChecker()
  const candidates = absoluteFiles.flatMap((absoluteFile) => {
    const sourceFile = program.getSourceFile(absoluteFile)

    if (!sourceFile) {
      throw new Error(`TypeScript did not load audit input: ${absoluteFile}`)
    }

    const file = normalizePath(relative(root, absoluteFile))
    return collectCandidates(sourceFile, checker, route, file)
  })

  candidates.sort(compareCandidate)

  const boundActions = candidates.filter(
    (candidate) => candidate.kind === 'action' && candidate.permissionKeys.length > 0,
  ).length
  const actions = candidates.filter((candidate) => candidate.kind === 'action').length

  return {
    schemaVersion: SCHEMA_VERSION,
    scope: {
      files: normalizedFiles,
      name: 'sales-ukraine-first-slice',
      route,
    },
    summary: {
      actions,
      boundActions,
      permissionChecks: candidates.length - actions,
      unboundActions: actions - boundActions,
    },
    candidates,
  }
}

export function serializeReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`
}

function collectCandidates(sourceFile, checker, route, reportFile) {
  const permissionBindings = collectPermissionBindings(sourceFile, checker)
  const candidates = []

  permissionBindings.checks.forEach((check) => {
    const location = getLocation(sourceFile, check.node, reportFile)
    candidates.push(
      finalizeCandidate({
        ...location,
        component: 'permission-check',
        controlType: 'permission-check',
        event: 'permission.evaluate',
        handler: `${check.callName}(${check.reference})`,
        humanLabel: check.variableName || check.reference,
        kind: 'permission-check',
        permissionKeys: check.key ? [check.key] : [],
        permissionReferences: [check.reference],
        route,
        status: check.key ? 'resolved' : 'unresolved-reference',
      }),
    )
  })

  visit(sourceFile, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
      return
    }

    const component = node.tagName.getText(sourceFile)
    const label = getHumanLabel(node, sourceFile)

    node.attributes.properties.forEach((attribute) => {
      if (!ts.isJsxAttribute(attribute)) {
        return
      }

      const propName = attribute.name.getText(sourceFile)
      const event = ACTION_PROPS.get(propName)

      if (!event || !attribute.initializer) {
        return
      }

      const contextText = collectGuardContext(node, attribute, sourceFile)
      const permissionMatches = resolveContextPermissions(
        contextText,
        permissionBindings,
      )
      const location = getLocation(sourceFile, node, reportFile)
      const permissionKeys = permissionMatches
        .map((match) => match.key)
        .filter((key) => Boolean(key))
        .sort(compareText)
      const permissionReferences = permissionMatches
        .map((match) => match.reference)
        .sort(compareText)

      candidates.push(
        finalizeCandidate({
          ...location,
          component,
          controlType: normalizeControlType(component),
          event,
          handler: normalizeExpression(attribute.initializer.getText(sourceFile)),
          humanLabel: label,
          kind: 'action',
          permissionKeys: [...new Set(permissionKeys)],
          permissionReferences: [...new Set(permissionReferences)],
          route,
          status: permissionKeys.length > 0 ? 'binding-candidate' : 'needs-review',
        }),
      )
    })
  })

  return candidates.sort(compareCandidate)
}

function collectPermissionBindings(sourceFile, checker) {
  const byVariable = new Map()
  const byReference = new Map()
  const checks = []

  visit(sourceFile, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile)
      if (tagName === 'Can' || tagName === 'PermissionGate') {
        const permissionAttribute = node.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            ['permission', 'permissionKey'].includes(
              property.name.getText(sourceFile),
            ),
        )
        if (
          permissionAttribute &&
          ts.isJsxAttribute(permissionAttribute) &&
          permissionAttribute.initializer
        ) {
          const initializer = permissionAttribute.initializer
          const permissionNode = ts.isJsxExpression(initializer)
            ? initializer.expression
            : initializer
          if (permissionNode) {
            const resolved = resolvePermission(
              permissionNode,
              checker,
              sourceFile,
            )
            byReference.set(resolved.reference, {
              callName: tagName,
              key: resolved.key,
              node: permissionNode,
              reference: resolved.reference,
              variableName: undefined,
            })
          }
        }
      }
    }

    if (!ts.isCallExpression(node) || node.arguments.length === 0) {
      return
    }

    const callName = node.expression.getText(sourceFile)
    if (!PERMISSION_CALLS.has(callName)) {
      return
    }

    const argument = node.arguments[0]
    const resolved = resolvePermission(argument, checker, sourceFile)
    const declaration = ts.isVariableDeclaration(node.parent)
      ? node.parent
      : undefined
    const variableName = declaration && ts.isIdentifier(declaration.name)
      ? declaration.name.text
      : undefined
    const binding = {
      callName,
      key: resolved.key,
      node,
      reference: resolved.reference,
      variableName,
    }

    checks.push(binding)
    byReference.set(binding.reference, binding)
    if (variableName) {
      byVariable.set(variableName, binding)
    }
  })

  return { byReference, byVariable, checks }
}

function resolvePermission(node, checker, sourceFile) {
  const reference = normalizeExpression(node.getText(sourceFile))

  if (ts.isStringLiteralLike(node)) {
    return { key: node.text, reference }
  }

  const type = checker?.getTypeAtLocation(node)
  if (type?.isStringLiteral()) {
    return { key: type.value, reference }
  }

  return { key: undefined, reference }
}

function collectGuardContext(opening, actionAttribute, sourceFile) {
  const parts = [actionAttribute.getText(sourceFile)]

  opening.attributes.properties.forEach((attribute) => {
    if (ts.isJsxAttribute(attribute) && attribute !== actionAttribute) {
      parts.push(attribute.getText(sourceFile))
    }
  })

  let current = opening.parent
  while (current && !ts.isSourceFile(current) && !ts.isFunctionLike(current)) {
    if (
      ts.isConditionalExpression(current) ||
      ts.isBinaryExpression(current) ||
      ts.isIfStatement(current)
    ) {
      parts.push(getGuardExpressionText(current, sourceFile))
    } else if (ts.isJsxElement(current)) {
      const tagName = current.openingElement.tagName.getText(sourceFile)
      if (tagName === 'Can' || tagName === 'PermissionGate') {
        parts.push(current.openingElement.getText(sourceFile))
      }
    }
    current = current.parent
  }

  return parts.join(' ')
}

function getGuardExpressionText(node, sourceFile) {
  if (ts.isConditionalExpression(node)) {
    return node.condition.getText(sourceFile)
  }
  if (ts.isIfStatement(node)) {
    return node.expression.getText(sourceFile)
  }
  return node.left.getText(sourceFile)
}

function resolveContextPermissions(contextText, bindings) {
  const matches = []

  bindings.byVariable.forEach((binding, variableName) => {
    if (hasIdentifier(contextText, variableName)) {
      matches.push(binding)
    }
  })
  bindings.byReference.forEach((binding, reference) => {
    if (contextText.includes(reference)) {
      matches.push(binding)
    }
  })

  return matches
}

function getHumanLabel(opening, sourceFile) {
  for (const propName of LABEL_PROPS) {
    const attribute = opening.attributes.properties.find(
      (property) =>
        ts.isJsxAttribute(property) &&
        property.name.getText(sourceFile) === propName,
    )
    if (attribute && ts.isJsxAttribute(attribute)) {
      const label = extractStaticValue(attribute.initializer, sourceFile)
      if (label) {
        return label
      }
    }
  }

  if (ts.isJsxElement(opening.parent)) {
    for (const child of opening.parent.children) {
      if (ts.isJsxText(child)) {
        const text = normalizeWhitespace(child.text)
        if (text) {
          return text
        }
      }
      if (ts.isJsxExpression(child)) {
        const text = extractExpressionValue(child.expression)
        if (text) {
          return text
        }
      }
    }
  }

  return null
}

function extractStaticValue(initializer, sourceFile) {
  if (!initializer) {
    return null
  }
  if (ts.isStringLiteral(initializer)) {
    return normalizeWhitespace(initializer.text)
  }
  if (ts.isJsxExpression(initializer)) {
    return extractExpressionValue(initializer.expression)
  }

  return normalizeWhitespace(initializer.getText(sourceFile)) || null
}

function extractExpressionValue(expression) {
  if (!expression) {
    return null
  }
  if (ts.isStringLiteralLike(expression)) {
    return normalizeWhitespace(expression.text)
  }
  if (
    ts.isCallExpression(expression) &&
    expression.arguments.length > 0 &&
    ts.isStringLiteralLike(expression.arguments[0])
  ) {
    return normalizeWhitespace(expression.arguments[0].text)
  }

  return null
}

function finalizeCandidate(candidate) {
  const signature = [
    candidate.file,
    candidate.line,
    candidate.column,
    candidate.kind,
    candidate.event,
    candidate.component,
    candidate.handler,
  ].join('|')

  return {
    id: `EPC-${createHash('sha256').update(signature).digest('hex').slice(0, 12)}`,
    ...candidate,
  }
}

function getLocation(sourceFile, node, reportFile) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return {
    column: location.character + 1,
    file: reportFile,
    line: location.line + 1,
  }
}

function readCompilerOptions(configPath) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(formatDiagnostic(config.error))
  }
  return ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    resolve(configPath, '..'),
  ).options
}

function formatDiagnostic(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}

function visit(node, visitor) {
  visitor(node)
  ts.forEachChild(node, (child) => visit(child, visitor))
}

function hasIdentifier(text, identifier) {
  return new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(identifier)}([^A-Za-z0-9_$]|$)`).test(text)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeControlType(component) {
  const normalized = component.toLocaleLowerCase()
  if (normalized.includes('menu.item')) return 'menu-item'
  if (normalized.includes('tablerow')) return 'row-action'
  if (normalized === 'form') return 'form'
  if (normalized.includes('button') || normalized.includes('actionicon')) return 'button'
  return component
}

function normalizeExpression(value) {
  const normalized = normalizeWhitespace(value)
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizePath(value) {
  return value.split(sep).join('/')
}

function compareCandidate(left, right) {
  return (
    compareText(left.file, right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    compareText(left.event, right.event) ||
    compareText(left.component, right.component)
  )
}

function compareText(left, right) {
  return left.localeCompare(right, 'en')
}

function parseCli(args) {
  const options = {
    check: false,
    files: [],
    output: DEFAULT_OUTPUT,
    route: DEFAULT_ROUTE,
    write: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--check') {
      options.check = true
    } else if (argument === '--write') {
      options.write = true
    } else if (argument === '--output') {
      options.output = requireValue(args, ++index, '--output')
    } else if (argument === '--route') {
      options.route = requireValue(args, ++index, '--route')
    } else if (argument === '--file') {
      options.files.push(requireValue(args, ++index, '--file'))
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (options.check && options.write) {
    throw new Error('--check and --write are mutually exclusive')
  }
  if (options.files.length === 0) {
    options.files = DEFAULT_FILES
  }

  return options
}

function requireValue(args, index, flag) {
  const value = args[index]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

function runCli() {
  const options = parseCli(process.argv.slice(2))
  const report = buildReport({ files: options.files, route: options.route })
  const serialized = serializeReport(report)
  const outputPath = resolve(process.cwd(), options.output)

  if (options.write) {
    writeFileSync(outputPath, serialized, 'utf8')
    process.stdout.write(`Wrote ${report.candidates.length} candidates to ${normalizePath(options.output)}\n`)
    return
  }

  if (options.check) {
    if (!existsSync(outputPath)) {
      process.stderr.write(`Candidate snapshot is missing: ${normalizePath(options.output)}\n`)
      process.exitCode = 1
      return
    }

    const current = readFileSync(outputPath, 'utf8').replaceAll('\r\n', '\n')
    if (current !== serialized) {
      process.stderr.write(
        `Candidate snapshot drifted: ${normalizePath(options.output)}. Review stdout, then run with --write explicitly.\n`,
      )
      process.exitCode = 1
      return
    }

    process.stdout.write(`Candidate snapshot is current (${report.candidates.length} candidates).\n`)
    return
  }

  process.stdout.write(serialized)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    runCli()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
