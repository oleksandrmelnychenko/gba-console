import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const EXPECTED_PERMISSION_COUNT = 499
const FRONTEND_KEYS_SOURCE = 'src/shared/auth/permissionKeys.ts'
const BACKEND_EXPORTER =
  'tools/Gba.EventPermissionCatalogExporter/Gba.EventPermissionCatalogExporter.csproj'

export function assertPermissionKeyParity({
  backendKeys,
  expectedCount = EXPECTED_PERMISSION_COUNT,
  frontendKeys,
}) {
  const frontend = normalizeKeys(frontendKeys, 'frontend')
  const backend = normalizeKeys(backendKeys, 'backend')
  const frontendSet = new Set(frontend)
  const backendSet = new Set(backend)
  const missingFromFrontend = backend.filter((key) => !frontendSet.has(key))
  const extraInFrontend = frontend.filter((key) => !backendSet.has(key))
  const errors = []

  if (frontend.length !== expectedCount) {
    errors.push(`frontend count ${frontend.length}, expected ${expectedCount}`)
  }
  if (backend.length !== expectedCount) {
    errors.push(`backend count ${backend.length}, expected ${expectedCount}`)
  }
  if (missingFromFrontend.length > 0) {
    errors.push(`missing from frontend: ${missingFromFrontend.join(', ')}`)
  }
  if (extraInFrontend.length > 0) {
    errors.push(`extra in frontend: ${extraInFrontend.join(', ')}`)
  }
  if (errors.length > 0) {
    throw new Error(`Event-permission parity failed: ${errors.join('; ')}`)
  }

  return {
    backendCount: backend.length,
    frontendCount: frontend.length,
    permissionCount: expectedCount,
  }
}

export async function loadFrontendPermissionKeys(root = process.cwd()) {
  const sourcePath = resolve(root, FRONTEND_KEYS_SOURCE)
  const sourceText = readFileSync(sourcePath, 'utf8')
  const javascript = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: sourcePath,
  }).outputText
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
  const permissionModule = await import(moduleUrl)

  return permissionModule.EVENT_PERMISSION_KEYS
}

export function loadBackendPermissionCatalog({
  backendRoot,
  dotnet = resolveDotnet(),
}) {
  const project = resolve(backendRoot, BACKEND_EXPORTER)
  if (!existsSync(project)) {
    throw new Error(`Backend catalog exporter not found: ${project}`)
  }

  const output = execFileSync(
    dotnet,
    [
      'run',
      '--project',
      project,
      '--configuration',
      'Release',
      '--verbosity',
      'quiet',
    ],
    {
      cwd: backendRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const payloadLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
  if (!payloadLine) throw new Error('Backend catalog exporter returned no JSON')

  const payload = JSON.parse(payloadLine)
  return {
    catalogVersion: String(payload.catalogVersion ?? ''),
    permissionKeys: payload.permissionKeys,
  }
}

function normalizeKeys(rawKeys, source) {
  if (!Array.isArray(rawKeys)) {
    throw new TypeError(`${source} permission keys must be an array`)
  }
  const keys = rawKeys.map((key) => String(key))
  const unique = new Set(keys)
  if (unique.size !== keys.length) {
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index)
    throw new Error(`${source} contains duplicate key ${duplicate}`)
  }
  return [...keys].sort((left, right) => left.localeCompare(right, 'en'))
}

function resolveDotnet() {
  if (process.env.GBA_DOTNET) return process.env.GBA_DOTNET
  if (process.env.DOTNET_ROOT) {
    const executable = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet'
    const candidate = join(process.env.DOTNET_ROOT, executable)
    if (existsSync(candidate)) return candidate
  }
  return 'dotnet'
}

function parseArgs(argv) {
  const options = {
    backendRoot: resolve(process.cwd(), '..', 'gba-server'),
    dotnet: resolveDotnet(),
    expectedCount: EXPECTED_PERMISSION_COUNT,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--backend-root') {
      options.backendRoot = resolve(argv[++index])
    } else if (argument === '--dotnet') {
      options.dotnet = argv[++index]
    } else if (argument === '--expected-count') {
      options.expectedCount = Number(argv[++index])
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return options
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2))
  const frontendKeys = await loadFrontendPermissionKeys()
  const backend = loadBackendPermissionCatalog(options)
  const result = assertPermissionKeyParity({
    backendKeys: backend.permissionKeys,
    expectedCount: options.expectedCount,
    frontendKeys,
  })
  console.log(JSON.stringify({
    ...result,
    catalogVersion: backend.catalogVersion,
    status: 'event_permission_parity_ok',
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
