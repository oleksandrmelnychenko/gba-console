import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { buildReport as buildCurrentActionReport } from './event-permission-candidates.mjs'

const SCHEMA_VERSION = 1
const DEFAULT_INPUT = 'docs/permission-event-matrix-audit-2026-08-14.json'
const DEFAULT_OUTPUT = 'docs/permission-event-matrix-reviewed.json'
const DEFAULT_BINDINGS = 'docs/event-permission-review-bindings.json'
const SOURCE_ROOT = 'src'
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const SOURCE_EXCLUDES = /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)|\.(?:test|spec)\.tsx?$/i

const BUSINESS_EVENTS = new Set([
  'command.delete',
  'command.export',
  'command.submit',
  'form.submit',
  'menu.item.select',
  'modal.open',
  'row.click',
  'control.double_click',
])

const TECHNICAL_EXACT_HANDLERS = new Set([
  'cancel',
  'close',
  'close_modal',
  'handle_close',
  'handle_toggle',
  'model_reset_filters',
  'on_cancel',
  'on_close',
  'on_refresh',
  'on_reload',
  'on_reset',
  'on_reset_filters',
  'on_toggle',
  'on_toggle_collapse',
  'refresh',
  'reload',
  'request_close',
  'reset_filters',
  'reset_search',
  'toggle_density',
])

const TECHNICAL_COMPONENTS = new Set([
  'ListTreeLayout',
  'Pagination',
  'Paginator',
  'SelectionMark',
  'TreeView',
])

export function classifyMatrix(
  matrix,
  {
    currentActionIndex,
    pageRouteBindings = [],
    permissionAliases = {},
    recordOverrides = {},
    sourceIndex,
  } = {},
) {
  if (!Array.isArray(matrix)) {
    throw new TypeError('matrix must be an array')
  }

  const seen = new Map()
  const records = matrix.map((rawRecord, index) => {
    const record = normalizeRecord(rawRecord, index)
    const source = locateSource(record, sourceIndex)
    const pagePermissionKeys = matchPagePermissions(record, pageRouteBindings)
    const currentGuard = matchCurrentGuard(record, source, currentActionIndex)
    const technicalReason = technicalReasonFor(record, currentGuard.evidence)
    const duplicateKey = buildDuplicateKey(record, currentGuard.evidence)
    const duplicateOf = seen.get(duplicateKey)
    const resolvedGuardKeys = resolveCanonicalKeys(
      currentGuard.permissionKeys,
      permissionAliases,
    )
    const override = recordOverrides[record.id] ?? null
    const canonicalPermissionKeys = [
      ...new Set([...pagePermissionKeys, ...resolvedGuardKeys]),
    ].sort(compareText)

    if (!duplicateOf) {
      seen.set(duplicateKey, record.id)
    }

    const automaticDisposition = chooseDisposition(record, {
      canonicalPermissionKeys,
      duplicateOf,
      technicalReason,
    })
    const review = applyRecordOverride({
      automaticDisposition,
      automaticDuplicateOf: duplicateOf,
      canonicalPermissionKeys,
      override,
      record,
    })
    const disposition = review.disposition
    return {
      ...record,
      disposition,
      dispositionReason:
        review.reason ??
        dispositionReason(record, {
          disposition,
          canonicalPermissionKeys: review.canonicalPermissionKeys,
          duplicateOf: review.duplicateOf,
          technicalReason,
        }),
      duplicateOf: review.duplicateOf,
      businessActionId: review.businessActionId,
      canonicalPermissionKeys: review.canonicalPermissionKeys,
      classificationSource: override ? 'manual_override' : 'automatic',
      bindingEvidence: currentGuard.evidence,
      source,
    }
  })

  const dispositionCounts = countBy(records, (record) => record.disposition)
  const technicalRecords = records.filter(
    (record) => record.disposition === 'technical_ui',
  )
  const duplicateRecords = records.filter(
    (record) => record.disposition === 'duplicate_occurrence',
  )
  const duplicateReferences = records.filter(
    (record) => record.duplicateOf !== null,
  )
  const reviewCandidates = records.filter(
    (record) =>
      record.disposition !== 'technical_ui' &&
      record.disposition !== 'duplicate_occurrence' &&
      record.disposition !== 'stale_or_aggregated' &&
      record.disposition !== 'covered_existing',
  )
  const unresolvedSourceRecords = records.filter(
    (record) => record.source.status !== 'resolved',
  )
  const currentActionResolved = records.filter(
    (record) => record.bindingEvidence.length > 0,
  ).length

  assertPartition(matrix.length, dispositionCounts)
  assertCleanCandidates(reviewCandidates)

  return {
    schemaVersion: SCHEMA_VERSION,
    summary: {
      inputRecords: records.length,
      classifiedRecords: Object.values(dispositionCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      dispositionCounts,
      reviewCandidates: reviewCandidates.length,
      technicalExcluded: technicalRecords.length,
      duplicatesExcluded: duplicateRecords.length,
      duplicateOccurrencesTotal: duplicateReferences.length,
      technicalDuplicateOverlap:
        duplicateReferences.length - duplicateRecords.length,
      sourceResolved: records.length - unresolvedSourceRecords.length,
      sourceUnresolved: unresolvedSourceRecords.length,
      currentActionResolved,
      currentActionUnresolved: records.length - currentActionResolved,
    },
    invariants: {
      allInputRecordsClassified:
        records.length ===
        Object.values(dispositionCounts).reduce(
          (total, count) => total + count,
          0,
        ),
      reviewCandidatesContainDuplicates: reviewCandidates.some(
        (record) => record.duplicateOf !== null,
      ),
      reviewCandidatesContainTechnicalUi: reviewCandidates.some(
        (record) => technicalReasonFor(record, record.bindingEvidence) !== null,
      ),
    },
    records,
    reviewCandidateIds: reviewCandidates.map((record) => record.id),
  }
}

export function buildReport({
  root = process.cwd(),
  input = DEFAULT_INPUT,
  bindings = DEFAULT_BINDINGS,
} = {}) {
  const inputPath = resolve(root, input)
  const bindingsPath = resolve(root, bindings)
  const inputText = readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
  const parsed = JSON.parse(inputText)
  const reviewBindings = JSON.parse(
    readFileSync(bindingsPath, 'utf8').replace(/^\uFEFF/, ''),
  )
  const matrix = parsed.matrix
  const sourceFiles = walkSourceFiles(resolve(root, SOURCE_ROOT))
  const sourceIndex = buildSourceIndex(sourceFiles, root)
  const currentActions = buildCurrentActionReport({
    files: sourceFiles.map((file) => normalizePath(relative(root, file))),
    root,
    route: '*',
  }).candidates.filter((candidate) => candidate.kind === 'action')
  const report = classifyMatrix(matrix, {
    currentActionIndex: indexCurrentActions(currentActions),
    pageRouteBindings: reviewBindings.pageRouteBindings ?? [],
    permissionAliases: reviewBindings.permissionAliases ?? {},
    recordOverrides: reviewBindings.recordOverrides ?? {},
    sourceIndex,
  })
  const currentPermissionBoundActions = currentActions.filter(
    (candidate) => candidate.permissionKeys.length > 0,
  ).length

  return {
    ...report,
    summary: {
      ...report.summary,
      currentProductionActions: currentActions.length,
      currentPermissionBoundActions,
      currentUnboundActions:
        currentActions.length - currentPermissionBoundActions,
    },
    source: {
      artifact: normalizePath(relative(root, inputPath)),
      bindings: normalizePath(relative(root, bindingsPath)),
      generatedAt: parsed.generatedAt ?? null,
      sha256: createHash('sha256')
        .update(readFileSync(inputPath))
        .digest('hex'),
    },
  }
}

function applyRecordOverride({
  automaticDisposition,
  automaticDuplicateOf,
  canonicalPermissionKeys,
  override,
  record,
}) {
  if (!override) {
    return {
      businessActionId: null,
      canonicalPermissionKeys,
      disposition: automaticDisposition,
      duplicateOf: automaticDuplicateOf ?? null,
      reason: null,
    }
  }

  const allowed = new Set([
    'business_candidate',
    'covered_existing',
    'duplicate_occurrence',
    'needs_human_review',
    'page_access',
    'stale_or_aggregated',
    'technical_ui',
  ])
  if (!allowed.has(override.disposition)) {
    throw new Error(`Invalid override disposition for ${record.id}`)
  }
  if (override.disposition === 'duplicate_occurrence' && !override.duplicateOf) {
    throw new Error(`Duplicate override ${record.id} must define duplicateOf`)
  }
  if (!String(override.reason ?? '').trim()) {
    throw new Error(`Override ${record.id} must define a reason`)
  }

  return {
    businessActionId: override.businessActionId ?? null,
    canonicalPermissionKeys: [
      ...new Set([
        ...canonicalPermissionKeys,
        ...(override.canonicalPermissionKeys ?? []).map(String),
      ]),
    ].sort(compareText),
    disposition: override.disposition,
    duplicateOf: override.duplicateOf ?? automaticDuplicateOf ?? null,
    reason: String(override.reason),
  }
}

function resolveCanonicalKeys(keys, aliases) {
  return keys.flatMap((key) => {
    if (aliases[key]) return [String(aliases[key])]
    return /^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(key) ? [key] : []
  })
}

export function serializeReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`
}

function normalizeRecord(record, index) {
  if (!record || typeof record !== 'object') {
    throw new TypeError(`matrix[${index}] must be an object`)
  }

  const id = String(record.id ?? '').trim()
  if (!id) {
    throw new Error(`matrix[${index}] has no id`)
  }

  return {
    id,
    domain: String(record.domain ?? 'unknown'),
    routes: [...new Set((record.routes ?? []).map(String))].sort(compareText),
    screenComponent: String(record.screenComponent ?? 'Unknown'),
    surface: String(record.surface ?? 'unknown'),
    uiText: String(record.uiText ?? ''),
    event: String(record.event ?? 'unknown'),
    targetEffect: String(record.targetEffect ?? ''),
    existingPermission: Array.isArray(record.existingPermission)
      ? [...new Set(record.existingPermission.map(String))].sort(compareText)
      : [],
    proposedPermission: String(record.proposedPermission ?? ''),
    securityLevel: String(record.securityLevel ?? 'unknown'),
    rawStatus: String(record.status ?? ''),
  }
}

function technicalReasonFor(record, currentActionEvidence = []) {
  const handlers = [
    normalizedHandler(record.targetEffect),
    ...currentActionEvidence.map((evidence) =>
      normalizedHandler(evidence.handler),
    ),
  ]
    .map((handler) =>
      handler
        .replace(/^event_event_stop_propagation_/, '')
        .replace(/^event_event_prevent_default_/, ''),
    )
    .filter((handler, index, all) => handler && all.indexOf(handler) === index)

  for (const handler of handlers) {
    const reason = technicalReasonForHandler(
      record,
      currentActionEvidence,
      handler,
    )
    if (reason) return reason
  }

  return null
}

function technicalReasonForHandler(
  record,
  currentActionEvidence,
  handler,
) {
  const effect = normalizeForMatch(record.targetEffect)
  const label = normalizeForMatch(record.uiText)
  const currentLabels = currentActionEvidence
    .map((evidence) => normalizeForMatch(evidence.humanLabel))
    .filter(Boolean)

  if (
    effect === 'execute event event stop propagation' ||
    effect ===
      'execute event react mouse event htmlbutton element if stop propagation e' ||
    effect === 'execute event event prevent default' ||
    effect === 'submit event event prevent default'
  ) {
    return 'event_plumbing_only'
  }

  if (
    record.event === 'link.navigate' ||
    /(?:^|_)navigate(?:_|$)/.test(handler)
  ) {
    return 'navigation_is_guarded_by_destination_page'
  }

  if (
    TECHNICAL_COMPONENTS.has(record.screenComponent) &&
    /(?:toggle|select|page|refresh)/.test(handler)
  ) {
    return 'shared_navigation_or_selection_control'
  }

  if (
    TECHNICAL_EXACT_HANDLERS.has(handler) ||
    /^(?:(?:model_)?set_.*(?:false|null)|set_(?:active_)?tab|set_(?:current_)?page|set_page_|set_search)/.test(
      handler,
    ) ||
    /(?:^|_)(?:next|previous)_page(?:_|$)/.test(handler) ||
    /^(?:model_|request_|state_|trigger_)?reload(?:_|$)/.test(handler) ||
    /^refresh_(?:data|list|payment_tasks|source_prices)(?:_|$)/.test(handler) ||
    /^(?:request_reload|set_reload_key|retry_.*search)(?:_|$)/.test(handler)
  ) {
    return 'local_ui_state_only'
  }

  if (
    record.event === 'button.click' &&
    /^(?:clear|reset)_(?:filter|filters|search|selection)/.test(handler)
  ) {
    return 'local_filter_or_search_control'
  }

  if (
    /^(?:apply_filters|clear_address|on_change_current_.*filter|on_city_filter|on_clear(?:_|$)|on_files_changed|on_reset_|on_select_all_pages|pagination_|reset_(?:changes|edits|form|grid|image|layout|list|page)|run_search|select_active_tab|select_group|set_exception_messages|set_expanded|set_filters|set_item_search|set_role_filter|submit_search)/.test(
      handler,
    )
  ) {
    return 'local_filter_or_form_state_only'
  }

  if (
    /^(?:on_toggle_expand|toggle_(?:agreement|description|documents_density|expand|marked))(?:_|$)/.test(
      handler,
    )
  ) {
    return 'local_expand_or_selection_state_only'
  }

  if (
    /^(?:can_expand_|can_sort_|change_tab|column_|combobox_toggle_dropdown|dispatch_filter_|dispatch_type_toggle_grid|event_event_stop_propagation_expand_|header_column_reset_size|on_density_change|on_go_to_step|on_step_click|on_tab_change|on_toggle_(?:description|existing_document|row)|toggle_overview_density|toggle_source)/.test(
      handler,
    )
  ) {
    return 'local_table_layout_or_navigation_control'
  }

  if (
    /^(?:copy(?:_|$)|copy_to_clipboard|void_copy_(?:link|prompt|sale_data))/.test(
      handler,
    )
  ) {
    return 'clipboard_uses_already_visible_data'
  }

  if (
    /^(?:clear_document_file|dispatch_credit_note_type_set_file_value_null|move_(?:left|right|selected_left|selected_right)|on_pick(?:_|$)|on_pick_(?:client|index|item|product)|on_select_(?:agreement|carrier|chip|client_agreement|client_type|consignment|income|null|organization|outcome)|props_on_region_change_null|readonly_undefined_on_select|set_basket_(?:new|qty)|set_order_pack_list_selected|set_outcome_source|set_role_client_type|set_selected_(?:category|forecast|region|sad|type|types))/.test(
      handler,
    )
  ) {
    return 'local_form_selection_only'
  }

  if (
    /^(?:active_0_request_exit_|no$|revert_editor_changes|system_prompt_read_only_13|перезавантажити_сторінку|спробувати_ще_раз)$/.test(
      handler,
    ) ||
    /^active_0_request_exit_/.test(handler)
  ) {
    return 'scanner_noise_or_local_recovery_control'
  }

  if (
    record.event === 'modal.open' &&
    /^(?:close|set_.*(?:false|null))/.test(handler)
  ) {
    return 'modal_close_state_only'
  }

  if (
    /^(?:скасувати|відмінити|cancel)$/.test(label) &&
    record.securityLevel === 'low'
  ) {
    return 'cancel_control_only'
  }

  if (
    currentLabels.some((currentLabel) =>
      /^(?:закрити|закрити без збереження|залишитися|назад|оновити|скасувати|скинути|очистити)$/.test(
        currentLabel,
      ),
    ) &&
    /(?:^|_)(?:cancel|clear|close|exit|previous|refresh|reload|reset)(?:_|$)/.test(
      handler,
    )
  ) {
    return 'current_source_confirms_local_cancel_or_refresh_control'
  }

  return null
}

function buildDuplicateKey(record, currentActionEvidence = []) {
  const currentActionIds = [
    ...new Set(currentActionEvidence.map((evidence) => evidence.candidateId)),
  ].sort(compareText)
  if (currentActionIds.length > 0) {
    return `current-action:${currentActionIds.join(',')}`
  }

  const routeKey = record.routes.join(',')
  const eventFamily = normalizeEventFamily(record.event)
  const handler = normalizedHandler(record.targetEffect)

  if (record.event === 'page.open') {
    return ['page.open', routeKey].map(normalizeForMatch).join('|')
  }

  return [
    record.domain,
    routeKey,
    record.screenComponent,
    eventFamily,
    handler,
  ]
    .map(normalizeForMatch)
    .join('|')
}

function normalizeEventFamily(event) {
  if (event === 'modal.open' || event === 'row.click' || event === 'control.double_click') {
    return 'details.open'
  }
  if (event === 'command.submit' || event === 'form.submit') {
    return 'command.submit'
  }
  return event
}

function normalizedHandler(targetEffect) {
  return normalizeForMatch(targetEffect)
    .replace(/^open row details for /, '')
    .replace(/^open /, '')
    .replace(/ modal drawer$/, '')
    .replace(/^submit /, '')
    .replace(/^execute /, '')
    .replace(/^delete cancel /, '')
    .replace(/^export download /, '')
    .replace(/^navigate to /, '')
    .replace(/ menu action$/, '')
    .replace(/ /g, '_')
}

function chooseDisposition(
  record,
  { canonicalPermissionKeys, duplicateOf, technicalReason },
) {
  if (technicalReason) return 'technical_ui'
  if (duplicateOf) return 'duplicate_occurrence'
  if (canonicalPermissionKeys.length > 0) return 'covered_existing'
  if (record.event === 'page.open') return 'page_access'
  if (
    record.existingPermission.length > 0 ||
    record.rawStatus.includes('existing key')
  ) {
    return 'needs_human_review'
  }
  if (
    BUSINESS_EVENTS.has(record.event) ||
    (record.event === 'button.click' && record.securityLevel !== 'low')
  ) {
    return 'business_candidate'
  }
  return 'needs_human_review'
}

function dispositionReason(
  record,
  { canonicalPermissionKeys, disposition, duplicateOf, technicalReason },
) {
  if (disposition === 'technical_ui') return technicalReason
  if (disposition === 'duplicate_occurrence') {
    return `same_normalized_action_as:${duplicateOf}`
  }
  if (disposition === 'covered_existing') {
    return `existing_page_permission:${canonicalPermissionKeys.join(',')}`
  }
  if (disposition === 'page_access') return 'route_entry_requires_page_access_review'
  if (disposition === 'business_candidate') {
    return 'security_relevant_event_requires_business_and_api_boundary_review'
  }
  if (
    record.existingPermission.length === 0 &&
    record.rawStatus.includes('existing key')
  ) {
    return 'raw_audit_claims_existing_binding_but_does_not_name_the_key'
  }
  return 'insufficient_evidence_for_automatic_permission_or_exclusion'
}

function matchPagePermissions(record, bindings) {
  if (record.event !== 'page.open') return []

  const keys = record.routes.flatMap((route) => {
    const normalizedRoute = normalizeRoute(route)
    const matches = bindings
      .filter((binding) => routeContains(normalizedRoute, normalizeRoute(binding.route)))
      .sort((left, right) =>
        normalizeRoute(right.route).length - normalizeRoute(left.route).length,
      )
    return matches[0]?.permissionKey ? [String(matches[0].permissionKey)] : []
  })
  return [...new Set(keys)].sort(compareText)
}

function routeContains(candidate, base) {
  return candidate === base || candidate.startsWith(`${base}/`)
}

function normalizeRoute(route) {
  const path = String(route ?? '').split('?')[0]
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function buildSourceIndex(sourceFiles, projectRoot) {
  const byComponent = new Map()

  for (const absoluteFile of sourceFiles) {
    const file = normalizePath(relative(projectRoot, absoluteFile))
    const sourceText = readFileSync(absoluteFile, 'utf8')
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    visit(sourceFile, (node) => {
      const name = declarationName(node)
      if (!name) return

      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const entries = byComponent.get(name) ?? []
      entries.push({
        file,
        line: location.line + 1,
        sourceText,
      })
      byComponent.set(name, entries)
    })
  }

  return byComponent
}

function indexCurrentActions(actions) {
  const byFile = new Map()
  for (const action of actions) {
    const entries = byFile.get(action.file) ?? []
    entries.push(action)
    byFile.set(action.file, entries)
  }
  return byFile
}

function matchCurrentGuard(record, source, actionIndex) {
  if (!actionIndex || !source.file || source.line === null) {
    return { permissionKeys: [], evidence: [] }
  }

  const actions = actionIndex.get(source.file) ?? []
  const rawTokens = handlerTokens(record.targetEffect)
  const matches = actions
    .map((action) => ({
      action,
      distance: Math.abs(action.line - source.line),
      score:
        rawTokens.length > 0
          ? handlerMatchScore(rawTokens, action.handler)
          : 0,
    }))
    .filter((match) => match.score > 0)

  if (matches.length === 0) {
    const normalizedLabel = normalizeForMatch(record.uiText)
    const labelMatches = actions.filter(
      (action) =>
        isMeaningfulActionLabel(normalizedLabel) &&
        normalizeForMatch(action.humanLabel) === normalizedLabel,
    )
    if (labelMatches.length !== 1) {
      return { permissionKeys: [], evidence: [] }
    }

    const action = labelMatches[0]
    return {
      permissionKeys: [...new Set(action.permissionKeys)].sort(compareText),
      evidence: [
        {
          candidateId: action.id,
          distance: Math.abs(action.line - source.line),
          file: action.file,
          handler: action.handler,
          humanLabel: action.humanLabel,
          line: action.line,
          permissionKeys: action.permissionKeys,
          score: normalizedLabel.length,
        },
      ],
    }
  }

  const highestScore = Math.max(...matches.map((match) => match.score))
  const highest = matches.filter((match) => match.score === highestScore)
  const shortestDistance = Math.min(...highest.map((match) => match.distance))
  const selected = highest.filter((match) => match.distance === shortestDistance)
  const permissionKeys = [
    ...new Set(selected.flatMap((match) => match.action.permissionKeys)),
  ].sort(compareText)

  return {
    permissionKeys,
    evidence: selected.map((match) => ({
      candidateId: match.action.id,
      distance: match.distance,
      file: match.action.file,
      handler: match.action.handler,
      humanLabel: match.action.humanLabel,
      line: match.action.line,
      permissionKeys: match.action.permissionKeys,
      score: match.score,
    })),
  }
}

function isMeaningfulActionLabel(label) {
  return (
    label.length >= 4 &&
    label !== 'без видимого тексту' &&
    /[a-zа-яіїєґ]/i.test(label)
  )
}

function handlerTokens(targetEffect) {
  const ignored = new Set([
    'event',
    'htmlbutton',
    'element',
    'mouse',
    'propagation',
    'react',
    'stop',
    'void',
  ])
  return normalizedHandler(targetEffect)
    .split('_')
    .filter((token) => token.length >= 3 && !ignored.has(token))
}

function handlerMatchScore(rawTokens, currentHandler) {
  const normalizedCurrent = normalizeForMatch(currentHandler).replace(/ /g, '')
  let longestMatch = ''
  const rawLength = rawTokens.reduce((total, token) => total + token.length, 0)

  for (let start = 0; start < rawTokens.length; start += 1) {
    let sequence = ''
    for (let end = start; end < rawTokens.length; end += 1) {
      sequence += rawTokens[end]
      if (normalizedCurrent.includes(sequence) && sequence.length > longestMatch.length) {
        longestMatch = sequence
      }
    }
  }

  if (longestMatch.length < 8 || longestMatch.length / rawLength < 0.7) return 0
  return longestMatch.length
}

function locateSource(record, sourceIndex) {
  if (!sourceIndex) {
    return { status: 'not_requested', file: null, line: null, alternatives: [] }
  }

  const matches = sourceIndex.get(record.screenComponent) ?? []
  if (matches.length === 0) {
    return { status: 'unresolved', file: null, line: null, alternatives: [] }
  }

  const ranked = matches
    .map((match) => ({
      ...match,
      score: sourceMatchScore(record, match),
    }))
    .sort((left, right) =>
      right.score - left.score || compareText(left.file, right.file),
    )
  const selected = ranked[0]

  return {
    status: ranked.length === 1 || selected.score > ranked[1]?.score
      ? 'resolved'
      : 'ambiguous',
    file: selected.file,
    line: findHandlerLine(selected.sourceText, record.targetEffect) ?? selected.line,
    alternatives: ranked.slice(1, 5).map((match) => match.file),
  }
}

function sourceMatchScore(record, match) {
  const path = normalizeForMatch(match.file)
  let score = basename(match.file, extname(match.file)) === record.screenComponent ? 10 : 0
  if (path.includes(normalizeForMatch(record.domain))) score += 2
  for (const route of record.routes) {
    const routeToken = route.split('/').filter(Boolean)[0]
    if (routeToken && path.includes(normalizeForMatch(routeToken))) score += 1
  }
  return score
}

function findHandlerLine(sourceText, targetEffect) {
  const handler = normalizedHandler(targetEffect).replace(/_/g, '')
  if (!handler || handler.length < 4) return null

  const lines = sourceText.split(/\r?\n/)
  const index = lines.findIndex((line) =>
    normalizeForMatch(line).replace(/ /g, '').includes(handler),
  )
  return index >= 0 ? index + 1 : null
}

function walkSourceFiles(root) {
  if (!existsSync(root)) return []

  const files = []
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    for (const entry of readdirSync(current)) {
      const absolute = resolve(current, entry)
      const normalized = normalizePath(absolute)
      if (statSync(absolute).isDirectory()) {
        pending.push(absolute)
      } else if (
        SOURCE_EXTENSIONS.has(extname(entry)) &&
        !SOURCE_EXCLUDES.test(normalized)
      ) {
        files.push(absolute)
      }
    }
  }
  return files.sort(compareText)
}

function declarationName(node) {
  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    node.name
  ) {
    return node.name.text
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text
  }
  return null
}

function visit(node, callback) {
  callback(node)
  node.forEachChild((child) => visit(child, callback))
}

function countBy(records, selector) {
  return records.reduce((counts, record) => {
    const key = selector(record)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function assertPartition(inputCount, counts) {
  const classified = Object.values(counts).reduce((total, count) => total + count, 0)
  if (classified !== inputCount) {
    throw new Error(`Classification partition mismatch: ${classified}/${inputCount}`)
  }
}

function assertCleanCandidates(candidates) {
  const duplicate = candidates.find((record) => record.duplicateOf !== null)
  if (duplicate) {
    throw new Error(`Canonical candidates contain duplicate ${duplicate.id}`)
  }
  const technical = candidates.find(
    (record) => technicalReasonFor(record, record.bindingEvidence) !== null,
  )
  if (technical) {
    throw new Error(`Canonical candidates contain technical UI ${technical.id}`)
  }
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
}

function normalizePath(value) {
  return value.split(sep).join('/')
}

function compareText(left, right) {
  return left.localeCompare(right, 'en')
}

function parseArgs(argv) {
  const options = {
    check: false,
    bindings: DEFAULT_BINDINGS,
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    write: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') options.check = true
    else if (argument === '--write') options.write = true
    else if (argument === '--bindings') options.bindings = argv[++index]
    else if (argument === '--input') options.input = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

function runCli() {
  const options = parseArgs(process.argv.slice(2))
  const report = buildReport({ bindings: options.bindings, input: options.input })
  const serialized = serializeReport(report)
  const outputPath = resolve(process.cwd(), options.output)

  if (options.write) {
    writeFileSync(outputPath, serialized, 'utf8')
  } else if (options.check) {
    if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== serialized) {
      throw new Error(
        `Reviewed matrix is stale. Run: node scripts/classify-event-permission-matrix.mjs --write`,
      )
    }
  }

  process.stdout.write(`${JSON.stringify(report.summary)}\n`)
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isMain) runCli()
