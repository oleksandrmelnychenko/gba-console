# Повний release-аудит системи подієвих пермішенів

Дата: 2026-08-24

Гілки:

- frontend: `D:\work\gba_console`, `codex/event-permissions`;
- backend: `D:\work\gba-server`, `codex/event-permissions`.

Статус документа: **поточний verdict `NO-GO` до required-SQL, migrator ×2 і
фінального runtime/browser E2E**. Погоджений breaking cutover та v4 role grant
вже реалізовані. Розділи 1–7 нижче
зберігають історичні checkpoints аудиту; актуальний консолідований стан після
remediation наведено в розділі 8 і має пріоритет над старими числами.

## 1. Каталог і frontend

- Code-owned canonical catalog: `486` унікальних ключів.
- Frontend/backend parity: `486/486`, catalog version `2026.08.24.63`.
- Inventory matrix: `1902/1902` класифіковано; `822 technical_ui`,
  `705 covered_existing`, `359 duplicate_occurrence`, `16 stale_or_aggregated`,
  `0 reviewCandidates`, `0 coveredWithoutBindingEvidence`.
- Reviewed matrix snapshot регенеровано штатним deterministic writer.
- `npm run verify:event-permissions`: PASS, включно з 1 candidate test,
  16 matrix tests, 4 parity tests і cross-repository parity.
- Фінальний frontend regression: `464/464` files, `2570/2570` tests;
  lint, TypeScript і production build PASS. Перший паралельний прогін мав
  один timing-flake; isolated repeat `4/4` і повторний повний suite
  `2570/2570` пройшли.
- Старий page-right editor, aliases/profile fallback, GBA/Admin global bypass,
  literal legacy `*PKEY*` та старі API редагування role/page permissions
  відсутні у live frontend code. Це не означає, що всі generic business API
  routes уже мігровані: їх окремий inventory наведено нижче.

## 2. Dependency security

- Production advisory `react-router-dom/react-router < 7.18.2` виправлено
  patch-оновленням до `7.18.2`.
- Сумісний `npm audit fix` оновив vulnerable dev/transitive packages
  `brace-expansion`, `nanoid`, `postcss`, `undici`.
- `npm audit --omit=dev --audit-level=high`: `0 vulnerabilities`.
- Повний `npm audit --audit-level=high`: `0 vulnerabilities`.
- Після dependency remediation повторний full regression виконано: PASS.

## 3. Runtime/browser acceptance

На локальному test-only стенді `http://localhost:18084/users/roles`:

- UI отримує `479/479` catalog records.
- Тимчасова роль: create → `0/479` → assign
  `dashboard.overview.page.view` → save → full refresh → persisted `1/479` →
  rename → delete.
- Модалка create/edit має один textbox `Найменування`; hidden role data не
  втрачаються.
- Двовкладковий optimistic-concurrency E2E: tab B зберіг version update, tab A
  отримав керований `409` alert `Конфлікт змін` з актуальною version і дією
  `Завантажити актуальні права`; silent overwrite не відбувся.
- Anonymous catalog request повертає `401`.
- Дві E2E-ролі та їх links/revisions видалено exact transactional cleanup з
  test-only БД; робочі ролі не змінювалися.

## 4. Знайдений P0 cutover defect

Поточний one-shot cutover матеріалізував старі legacy/dashboard assignments,
але не матеріалізував старий elevated bypass перед створенням revision:

- `GBA`: `479/479` canonical links;
- `Administrator`: лише `225/479` canonical links;
- втрачений implicit access Administrator: `254` keys.

Це release blocker: після strict cutover Administrator тихо втрачає доступ.
Потрібні one-time elevated materialization для uncut roles і repair path для
вже помилково cutover roles, після чого SQL tests повинні довести:

- GBA і Administrator мають `479/479` після repair;
- повторний migrator нічого не додає;
- подальші explicit revocations не воскресають.

## 5. Незавершені gates

Додатковий незалежний backend-аудит виявив системні P0:

- зі `739` public routed methods із `RequirePermission` `411` одночасно
  перетинаються зі старими role policies (`366 InternalMutation`,
  `33 Administrative`, `16 IdentityAdministration`, чотири подвійні), ще три
  мають direct `Authorize(Roles)` у ProtocolAct. Custom-роль із точним ключем
  тому все одно може отримати `403`; ungated endpoints мають залишитися під
  старим whitelist, доки для них немає canonical gate;
- live navigation досі читає `UserRoleDashboardNode` і має GBA bypass, тому
  grant/revoke `*.page.view` ще не є source of truth для меню/route guard;
- Roslyn scan wrapper→core invocations знайшов `468` унікальних public routed
  legacy core methods: лише `38` уже мають canonical gate, `1` повертає
  `410 Gone`, `429` лишаються ungated (`223` mutation, `201` read, `5` без
  явного `Http*`). Із них `349` мають один exact facade key і можуть зберегти
  старий URL лише з тим самим `RequirePermission`; `80` є multi-context і
  мають бути retired/`NonAction` після міграції caller-ів. OR між context keys
  заборонений, бо створює cross-context bypass;
- у Sales/Protocol/Delivery залишилися public generic routes і actor policies,
  через які можна обійти canonical facade або, навпаки, canonical custom-роль
  блокується старим role/PKEY gate;
- `MergedServicesActor` помилково використовує право редагування завершеного
  delivery protocol для редагування завершеного SupplyOrder; потрібен окремий
  order-domain key;
- exact-literal scan `D:\work\gba_client` не підтвердив викликів вибіркових
  generic Sales/ProtocolAct/TTN/Delivery routes, але це не доводить їх
  відсутність: C# client може складати URL із constants/segments. Перед retire
  потрібен окремий audit route constants/reflection або explicit припинення
  підтримки цього client;
- поточна test-only БД ще на `479`/`2026.08.19.62`; міграція
  `20260824145922_AddRoleEventPermissionCatalogUpgrade`, catalog `486` і
  role-upgrade markers до неї ще не застосовані.

Поточний remediation checkpoint:

- backend API і Database.Migrator Release build: PASS, `0 warnings / 0 errors`;
- EventPermission non-SQL suite: `119 passed / 0 failed / 6 SQL skipped`;
- expanded actor authorization: PASS, `88/88`;
- elevated materialization, repair-after-v1 та revocation persistence
  реалізовані; SQL-доказ ще очікує фінального required run;
- actor role/PKEY bypass cutover для sales edit/delete, packing, unlock,
  locked order items і payment document реалізований canonical-only; окремий
  v2 one-time role upgrade зберігає чинний доступ старих role types;
- bulk policy cutover очікує явного security-підтвердження: механічна заміна
  старого role whitelist лише на endpoint-ах, які вже мають точний
  `[RequirePermission]`; ungated endpoint-и не відкриваються.

## 6. Exact frontend caller audit

Масовий `[NonAction]`/`410 Gone` для generic legacy routes зараз не є
release-safe:

- у production `gba_console/src` підтверджено `73` унікальні generic legacy
  route literals та ще `10` живих Sales routes зі special-contract family;
  разом `83` підтверджені route blockers;
- P0 mutations лишилися у Clients, consignment settings, payments,
  write-off rules, resales, storages, supplies та Sales;
- multi-context reads/documents лишилися у clients/products/users/payments/
  storages/supplies/transporters. Для них один global replacement або OR між
  кількома keys є помилковим: потрібні scoped routes для конкретного business
  context;
- Sales generic fallbacks реально використовуються Sales Cockpit, Client
  Recommendations і Warehouse, тому retire поточних `/sales/get*` та
  `/sales/update*` зламає робочі сценарії;
- безпечний порядок: спочатку створити відсутні scoped policies/routes,
  перенести P0 mutations, потім documents, потім reads; після `0` live callers
  інвертувати backend compatibility tests на `404/410` і лише тоді retire;
- обов'язковий gate: exact `rg`/contract scan усіх підтримуваних clients,
  frontend route-deprecation test та API `401/403/200` tests на кожний context.

## 7. Рішення, без яких cutover заблокований

Потрібне явне підтвердження власника системи на пакет access-affecting змін:

1. Dynamic `RequirePermission` стає authenticated internal-user + exact-key
   policy для всіх `739` protected routes; old role-policy intersection
   прибирається з `411` exact-gated routes, але не з ungated whitelist routes.
2. `349` single-context legacy URLs отримують той самий exact key; `80`
   multi-context routes retire лише після перенесення всіх live callers.
3. Меню і route guard переходять з `UserRoleDashboardNode` на canonical
   `*.page.view`; GBA bypass і legacy writer видаляються.
4. ProtocolAct, SaleReturns і completed SupplyOrder переходять із role/domain
   bypass на нові exact high-risk keys з one-time upgrade старих assignment-ів.
5. Перший production-style migrator стає fail-closed на unknown dashboard
   routes і виконується тільки після preflight/backup.
6. У test-only БД exact cleanup видаляє лише `25` відомих тестових link-змін
   за ID/assertions, після чого виконуються strict migration, SQL idempotency,
   API та browser E2E.

До підтвердження ці пункти не виконуються; поточний verdict лишається
`NO-GO`, навіть попри зелені safe-checkpoint тести.

- [ ] P0 elevated materialization/repair реалізовано і перевірено.
- [ ] Backend build/security/contract/actor tests PASS після fix.
- [ ] Required-SQL integration PASS після fix.
- [ ] Clean migrator first/second run та DB invariants PASS.
- [ ] Залишкові direct role-type business rules класифіковано як permission
  bypass або workflow invariant; permission bypass замінено canonical gates.
- [x] Frontend full regression повторено після frontend remediation.
- [x] Документацію clean deploy/rollback і точні code commit IDs звірено.
- [x] Кодові зміни обох робочих дерев reviewed і зафіксовані логічними
  commit у `codex/event-permissions`; push не виконувався.

## 8. Актуальний remediation checkpoint

### Каталог і frontend

- Code-owned catalog: `490` canonical keys, version `2026.08.24.65`.
- Parity: backend `490` = frontend definitions `490` = effective keys `490`.
- Matrix: `1902/1902`, `reviewCandidates=0`.
- Full frontend: `466/466` files, `2598/2598` tests PASS; lint, production
  build, catalog verification і parity PASS.
- Підтримуваний Console перенесений на всі нефінансові exact facades,
  включно з Resale, Sales registry, Pricing, SAD-to-order, Outgoing та Other
  Income. Fail-closed allowlist скорочено з `17` до `11`: лишилися тільки
  financial create calls, що очікують access approval.

### Security findings

Остання незалежна ревалідація перед breaking cutover дала **7 CLOSED / 2
PARTIAL / 1 OPEN**; нових high/critical регресій не знайдено. Три залишкові
route blockers після цього погоджено й закрито HTTP `410`; фінальна
ревалідація після required-SQL/runtime acceptance ще потрібна.

- CLOSED: SEC01/02 exact Sales update gates; SEC04 server-owned warehouse
  context; SEC05 actor/ledger/eligibility warehouse print-state; SEC06
  persisted SupplyInvoice payment graph; SEC08 retired identity writers;
  SEC10 exact role-details key.
- SEC09 supported path CLOSED: шість exact responsible-user facades не
  приймають `types`, сервер фіксує active `FinanceDirector` і повертає лише
  ID/NetUid/ПІБ без email, телефону, регіону та role graph.
- SEC03 legacy `/sales/get/shifted/document`, SEC07 generic
  `/supplies/invoices/delete/document` та identity sink
  `/usermanagement/profiles/all/by` після явного breaking approval повертають
  HTTP `410`; підтримуваний Console використовує exact facades.

### Backend verification

- Focused v4 migrator contract: `7/7` PASS.
- Full Security suite: `232` PASS, `0` FAIL, `6` opt-in SQL skipped.
- Gate 1: `0` legacy-policy intersections серед `1182` exact-protected
  actions; deterministic повторний dry-run змінює `0` files.
- Gate 2: compiled-IL surface `458` edges = `380` exact-gated + `78`
  retired, `0` single-context, `0` multi-context, `0` unresolved.
- Manifest regenerated з compiled API; drift contract PASS.
- Повний non-SQL API suite після route retirement, exact-policy cutover та v4
  grant: `944` PASS, `0` FAIL, `2` opt-in live-dev SQL skipped.
- API Release build: `0 warnings / 0 errors`; focused actor authorization:
  `65/65` PASS.
- Frontend route cutover contract: `3/3` PASS; focused lookup regression:
  `153/153` PASS; full suite `2598/2598`, lint/build/parity PASS.

### Test-only DB preflight

`ConcordDb_EventPermissionsCurrent` ще на catalog `479`/`.62`, latest
migration `20260819212020_EnforceActiveRolePermissionUniqueness`.

- active RolePermission: `3010`;
- active Event role links: `1912`;
- рівно `24` test-created links: IDs `43240..43263`, role `2`, timestamp
  `2026-08-24T14:12:55.6318541`;
- link `12617`/permission `159` тимчасово revived; історичний стан
  `Deleted=1`, `Updated=2026-08-17T16:32:13.2594154`;
- role `2` revision: ID `1`, version `4`, identity fields незмінні.

Cleanup не виконаний: safety gate очікує явної згоди власника. Після
транзакційного cleanup очікуються `2985` active links, `1887` active Event
links і `20` Event links role `2`, revision не змінюється.

### Approval-gated пакети

1. **Виконано:** retire `77` multi-context URLs і окремо
   `/usermanagement/profiles/all/by`; старий `D:\work\gba_client`/зовнішні
   інтеграції на цих URL перестануть працювати.
2. **Виконано:** прибрати `586` старих role-policy intersections лише з exact-protected
   actions; ungated whitelist actions не відкривати.
3. Переприв'язати `11` financial create calls на exact context routes;
   користувач без нового key отримає `403`.
4. Виконати exact cleanup `25` test-only link changes за наведеним preflight.
5. **Виконано через v4:** одноразово видати
   `sales.ukraine.sale.convert_merged_to_bill` лише `Administrator`, `GBA`,
   `HeadSalesAnalytic`.

Поточний залишок: exact cleanup `25` test-only link changes (лише після
окремого approval) → Database.Migrator ×2 → required SQL → rebuild існуючого
Docker стенду → runtime `401/403/409` + GET/PUT/GET → browser E2E → остаточний
`GO/NO-GO`. Окремо залишаються `11` financial create calls, для яких owner ще
не визначив exact access policy.

### Code commits checkpoint

Backend: `b8f825725`, `1afac15df`, `96585af3c`, `27c9a962b`.

Frontend: `4061be85`, `a5ef53dc`, `99ed7621`, `7b250e32`.
