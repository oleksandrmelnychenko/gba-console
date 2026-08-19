# Event permissions — release checkpoint 2026-08-20

## Стан

- Frontend branch: `codex/event-permissions`, синхронізована з `origin/main`
  (`0 behind`).
- Backend branch: `codex/event-permissions`, синхронізована з
  `origin/development` (`0 behind`).
- Code-owned backend catalog: 479 active definitions, 479 unique keys,
  catalog version `2026.08.19.62`.
- Frontend effective key set: 479 unique keys.
- Cross-repository parity: `479 = 479`, missing/extra/duplicates = 0.
- Reviewed UI audit: 1902/1902 classified, review candidates = 0,
  source unresolved = 0, covered without binding evidence = 0.

## Перевірки

- Frontend: 462/462 test files, 2564/2564 Vitest tests, ESLint, app/node
  typecheck і production build пройшли.
- Unified frontend gate: `npm run verify:event-permissions` пройшов; він
  перевіряє candidate snapshot, reviewed matrix, audit tests і фактичну
  backend/frontend parity.
- Backend REQUIRED SQL verifier: API/security/migration/SQL 101/101,
  actor authorization 17/17, skipped = 0.
- Runtime catalog: 479 active definitions, 79 pages, 238 groups, 12 sections,
  required metadata gaps = 0.
- Role API: GET → PUT → GET, independent same-name keys, version 0→1→2,
  stale write `409`, unauthenticated `401`, insufficient role `403`.
- Protected HTTP matrix: 20/20 calls returned `403` before assignment;
  after assignment 20/20 reached `200` or business-validation `400`.

## БД та migration safety

- Required SQL integration executed on test-only
  `ConcordDb_EventPermissionsCurrent`; 3/3 passed with exact cleanup/read-only
  inventory behavior.
- Legacy inventory union has 159 keys: 157 active and 1 deleted legacy
  definitions plus alias-only compatibility entries. Every key has a
  code-owned disposition and deterministic JSON snapshot: 157
  `alias_to_canonical`, 1 `split_to_canonical`, 1 `inactive_orphan`.
- Alias rows transitioned idempotently from pre-sync 156 to post-sync 158;
  no extra canonical definition or UI permission was created.
- The two previously unmapped active Tax Free carrier keys are now explicit:
  document download maps to export; the old combined add/remove permission
  splits into create and delete. Both had six active role links in the
  inventory snapshot.
- Active physical duplicate `RolePermission(UserRoleID, PermissionID)` groups:
  0. Duplicate ControlId/alias/revision groups and orphan active links: 0.
- 156 effective overlaps are intentional canonical+legacy-alias pairs in two
  roles. They are preserved for backward compatibility and are not physical
  duplicates.
- Migration `20260819212020_EnforceActiveRolePermissionUniqueness` adds a
  fail-closed preflight and a filtered unique index for active role links.
- EF snapshot has no pending model changes; migration contract 2/2 passed.
- Transactional migration dry-run created and verified the unique filtered
  index, then rolled back. Post-check confirmed the original non-unique index
  and zero migration-history rows, so the test DB was not changed.

## Rollback

1. Stop frontend rollout before rolling back backend contracts.
2. Roll back backend deployment to the previous `codex/event-permissions`
   build if runtime authorization fails.
3. The new RolePermission migration `Down` restores the previous non-unique
   index and does not delete role assignments.
4. Event catalog migration rollback remains non-destructive for permission and
   role-link data; metadata-only tables/columns are removed by its `Down`.
5. Re-run role GET/effective permissions and representative protected calls
   before restoring frontend traffic.

## Залишок до production rollout

- Formal browser click-through for role save/refresh and representative UI
  actions; current local browser-control connector fails before attaching to
  the page. Component and runtime API acceptance are green.
- Transactional physical reconciliation of the 1098 pre-existing active
  legacy role assignments; logical mapping is complete and legacy aliases
  remain effective during rollout.
- Production backup and complete migration dry-run on the final restore point.
- Deploy in order: migrations → backend/catalog sync → frontend → role rollout.
- Monitor authorization failures and complete the final before/after/rollback
  report after production smoke tests.

No new Docker image or volume was created for these final checks. Temporary
EF10 tool directories were removed after each use; credentials were never
printed or committed.
