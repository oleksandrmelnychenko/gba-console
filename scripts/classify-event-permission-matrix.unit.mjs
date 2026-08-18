import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyMatrix,
  serializeReport,
} from './classify-event-permission-matrix.mjs'

function candidate(id, overrides = {}) {
  return {
    id,
    domain: 'accounting',
    routes: ['/accounting/banks'],
    screenComponent: 'AccountingBanksPage',
    surface: 'Button',
    uiText: 'Без видимого тексту',
    event: 'button.click',
    targetEffect: 'Execute reload',
    existingPermission: [],
    proposedPermission: `accounting.banks.${id}`,
    securityLevel: 'low',
    status: 'No permission candidate found',
    ...overrides,
  }
}

test('partitions every record and excludes technical UI and duplicates', () => {
  const report = classifyMatrix([
    candidate('PE-00001'),
    candidate('PE-00002', {
      event: 'page.open',
      targetEffect: 'Open page /accounting/banks',
      proposedPermission: 'accounting.banks.page.open',
      securityLevel: 'high',
    }),
    candidate('PE-00003', {
      event: 'command.submit',
      targetEffect: 'Submit handle_save',
      proposedPermission: 'accounting.banks.save.command_submit',
      securityLevel: 'high',
    }),
    candidate('PE-00004', {
      event: 'command.submit',
      targetEffect: 'Submit handle_save',
      proposedPermission: 'accounting.banks.save.command_submit.2',
      securityLevel: 'high',
    }),
    candidate('PE-00005', {
      targetEffect: 'Execute button_click',
      proposedPermission: 'accounting.banks.unknown.button_click',
    }),
  ])

  assert.equal(report.summary.inputRecords, 5)
  assert.equal(report.summary.classifiedRecords, 5)
  assert.equal(report.summary.duplicateOccurrencesTotal, 1)
  assert.deepEqual(report.summary.dispositionCounts, {
    technical_ui: 1,
    page_access: 1,
    business_candidate: 1,
    duplicate_occurrence: 1,
    needs_human_review: 1,
  })
  assert.equal(report.records[3].duplicateOf, 'PE-00003')
  assert.equal(report.invariants.reviewCandidatesContainDuplicates, false)
  assert.equal(report.invariants.reviewCandidatesContainTechnicalUi, false)
})

test('maps nested routes to the longest existing page permission', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        routes: ['/products/:netId'],
        event: 'page.open',
        targetEffect: 'Open page /products/:netId',
        proposedPermission: 'products.products_item.page_open',
      }),
    ],
    {
      pageRouteBindings: [
        { route: '/products', permissionKey: 'products.assortment.page.view' },
      ],
    },
  )

  assert.equal(report.records[0].disposition, 'covered_existing')
  assert.deepEqual(report.records[0].canonicalPermissionKeys, [
    'products.assortment.page.view',
  ])
  assert.equal(report.summary.reviewCandidates, 0)
})

test('does not bind an action from a shared short handler word', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'command.delete',
        targetEffect: 'Delete/cancel remove_rule_row',
        securityLevel: 'high',
      }),
    ],
    {
      currentActionIndex: new Map([
        [
          'src/Page.tsx',
          [
            {
              id: 'EPC-false',
              file: 'src/Page.tsx',
              handler: '{removeImage}',
              line: 10,
              permissionKeys: ['image.delete'],
            },
          ],
        ],
      ]),
      sourceIndex: new Map([
        [
          'AccountingBanksPage',
          [{ file: 'src/Page.tsx', line: 1, sourceText: 'remove_rule_row' }],
        ],
      ]),
    },
  )

  assert.equal(report.records[0].disposition, 'business_candidate')
  assert.deepEqual(report.records[0].canonicalPermissionKeys, [])
})

test('does not bind sibling actions that only share a handler prefix', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'modal.open',
        targetEffect: 'Open on_open_panel_analytics modal/drawer',
        securityLevel: 'medium',
      }),
    ],
    {
      currentActionIndex: new Map([
        [
          'src/Page.tsx',
          [
            {
              id: 'EPC-edit',
              file: 'src/Page.tsx',
              handler: "{() => onOpenPanel('edit')}",
              line: 10,
              permissionKeys: ['product.edit'],
            },
          ],
        ],
      ]),
      sourceIndex: new Map([
        [
          'AccountingBanksPage',
          [
            {
              file: 'src/Page.tsx',
              line: 1,
              sourceText: "onOpenPanel('analytics')",
            },
          ],
        ],
      ]),
    },
  )

  assert.equal(report.records[0].disposition, 'business_candidate')
  assert.deepEqual(report.records[0].canonicalPermissionKeys, [])
})

test('uses one exact current action label when a legacy handler contains only UI text', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'command.submit',
        targetEffect: 'Submit новии_регіон',
        uiText: 'Новий регіон',
        securityLevel: 'high',
      }),
    ],
    {
      currentActionIndex: new Map([
        [
          'src/Page.tsx',
          [
            {
              id: 'EPC-create-region',
              file: 'src/Page.tsx',
              handler: '{openCreateRegion}',
              humanLabel: 'Новий регіон',
              line: 10,
              permissionKeys: ['counterparties.resources.region.create'],
            },
          ],
        ],
      ]),
      sourceIndex: new Map([
        [
          'AccountingBanksPage',
          [{ file: 'src/Page.tsx', line: 1, sourceText: 'Новий регіон' }],
        ],
      ]),
    },
  )

  assert.equal(report.records[0].disposition, 'covered_existing')
  assert.deepEqual(report.records[0].canonicalPermissionKeys, [
    'counterparties.resources.region.create',
  ])
})

test('uses exact current labels to exclude local cancel controls', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'command.submit',
        targetEffect: 'Submit confirm_drawer_close',
        securityLevel: 'high',
      }),
    ],
    {
      currentActionIndex: new Map([
        [
          'src/Page.tsx',
          [
            {
              id: 'EPC-close',
              file: 'src/Page.tsx',
              handler: '{confirmDrawerClose}',
              humanLabel: 'Закрити без збереження',
              line: 10,
              permissionKeys: [],
            },
          ],
        ],
      ]),
      sourceIndex: new Map([
        [
          'AccountingBanksPage',
          [
            {
              file: 'src/Page.tsx',
              line: 1,
              sourceText: 'confirmDrawerClose',
            },
          ],
        ],
      ]),
    },
  )

  assert.equal(report.records[0].disposition, 'technical_ui')
  assert.equal(
    report.records[0].dispositionReason,
    'current_source_confirms_local_cancel_or_refresh_control',
  )
})

test('deduplicates raw records that resolve to the same current JSX action', () => {
  const action = {
    id: 'EPC-save',
    file: 'src/Page.tsx',
    handler: '{handleSave}',
    humanLabel: 'Зберегти',
    line: 10,
    permissionKeys: [],
  }
  const sourceIndex = new Map([
    [
      'AccountingBanksPage',
      [{ file: 'src/Page.tsx', line: 1, sourceText: 'handleSave' }],
    ],
  ])
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        targetEffect: 'Execute handle_save',
        securityLevel: 'high',
      }),
      candidate('PE-00002', {
        event: 'command.submit',
        targetEffect: 'Submit handle_save',
        securityLevel: 'high',
      }),
    ],
    {
      currentActionIndex: new Map([['src/Page.tsx', [action]]]),
      sourceIndex,
    },
  )

  assert.equal(report.records[0].disposition, 'business_candidate')
  assert.equal(report.records[1].disposition, 'duplicate_occurrence')
  assert.equal(report.records[1].duplicateOf, 'PE-00001')
})

test('excludes table layout and clipboard controls but keeps business retry actions', () => {
  const report = classifyMatrix([
    candidate('PE-00001', {
      targetEffect: 'Execute column_toggle_visibility_false',
    }),
    candidate('PE-00002', {
      targetEffect: 'Execute copy_to_clipboard_get_product_code',
    }),
    candidate('PE-00003', {
      targetEffect: 'Execute void_retry_pending_cart_mutation',
      securityLevel: 'high',
    }),
  ])

  assert.equal(report.records[0].disposition, 'technical_ui')
  assert.equal(report.records[1].disposition, 'technical_ui')
  assert.equal(report.records[2].disposition, 'business_candidate')
})

test('serialization is deterministic', () => {
  const input = [candidate('PE-00001')]
  assert.equal(
    serializeReport(classifyMatrix(input)),
    serializeReport(classifyMatrix(input)),
  )
})

test('excludes a manually proven stale or aggregated scanner record', () => {
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'form.submit',
        targetEffect: 'Submit removed_legacy_form',
        securityLevel: 'high',
      }),
    ],
    {
      recordOverrides: {
        'PE-00001': {
          disposition: 'stale_or_aggregated',
          reason: 'The current source has no such executable action.',
        },
      },
    },
  )

  assert.equal(report.records[0].disposition, 'stale_or_aggregated')
  assert.equal(report.summary.reviewCandidates, 0)
})

test('treats navigation and form-only controls as technical but keeps wrapped business openers', () => {
  const report = classifyMatrix([
    candidate('PE-00001', {
      targetEffect: 'Execute navigate_users_roles',
      securityLevel: 'medium',
    }),
    candidate('PE-00002', {
      event: 'form.submit',
      targetEffect: 'Submit apply_filters',
      securityLevel: 'high',
    }),
    candidate('PE-00003', {
      event: 'modal.open',
      targetEffect:
        'Open event_event_stop_propagation_on_open_product_card_net_id modal/drawer',
      securityLevel: 'medium',
    }),
  ])

  assert.equal(report.records[0].disposition, 'technical_ui')
  assert.equal(report.records[1].disposition, 'technical_ui')
  assert.equal(report.records[2].disposition, 'business_candidate')
})

test('uses the resolved current handler to identify technical form and table controls', () => {
  const currentActionIndex = new Map([
    [
      'src/Page.tsx',
      [
        {
          id: 'EPC-filters',
          file: 'src/Page.tsx',
          handler: '{(event) => { event.preventDefault() applyFilters() }}',
          humanLabel: 'Застосувати',
          line: 10,
          permissionKeys: [],
        },
        {
          id: 'EPC-density',
          file: 'src/Page.tsx',
          handler: "{() => onDensityChange('compact')}",
          humanLabel: 'Компактно',
          line: 20,
          permissionKeys: [],
        },
      ],
    ],
  ])
  const sourceIndex = new Map([
    [
      'AccountingBanksPage',
      [
        {
          file: 'src/Page.tsx',
          line: 1,
          sourceText: 'applyFilters onDensityChange',
        },
      ],
    ],
  ])
  const report = classifyMatrix(
    [
      candidate('PE-00001', {
        event: 'form.submit',
        targetEffect: 'Submit apply_filters',
      }),
      candidate('PE-00002', {
        targetEffect: 'Execute on_density_change_compact',
      }),
    ],
    { currentActionIndex, sourceIndex },
  )

  assert.equal(report.records[0].disposition, 'technical_ui')
  assert.equal(report.records[1].disposition, 'technical_ui')
})
