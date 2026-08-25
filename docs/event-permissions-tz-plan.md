# ТЗ і план: корпоративна система подієвих пермішенів

## Статус документа

- Робочі проєкти: `D:\work\gba_console`, `D:\work\gba-server`.
- Робочі гілки: `codex/event-permissions` у кожному репозиторії.
- UI керування ролями: `/users/roles`.
- Цільовий code-owned каталог: 490 активних подієвих пермішенів, version
  `2026.08.24.65`. Поточний запущений test-only runtime ще на попередньому
  checkpoint `479`/`2026.08.19.62` до фінального migrator/rebuild.
- Legacy mapping у поточному каталозі: 158 distinct keys / 159 target
  bindings (один старий широкий ключ явно split на два canonical права).
- Останнє оновлення статусу: 2026-08-24.

Цей файл є єдиним робочим ТЗ і чеклістом виконання. Позначка `[x]`
означає, що пункт реалізований у робочих гілках; `[ ]` — що робота або
фінальна перевірка ще потрібна.

## 1. Мета і принципи

- [x] Централізований типізований каталог granular/event-level permissions.
- [x] Стабільні бізнес-ключі формату `{domain}.{feature}.{resource}.{action}`.
- [x] Людські назви, описи, сторінка, секція, група, тип контролу і ризик.
- [x] Клієнтські guards і серверні policies використовують ті самі ключі.
- [x] Визначення контролюються кодом, призначення ролям зберігаються в БД.
- [x] Технічний DOM-клік не є окремим правом без самостійної бізнес-події.
- [x] Одна бізнес-операція не дублюється через кілька UI-точок входу.
- [x] Незалежні бізнес-події з однаковим видимим текстом мають різні ключі.

## 2. Обов'язкова інтеграція всіх наявних прав

Наявні до впровадження системи права, історичні `ControlId`, legacy keys,
серверні policy names і призначення ролям є частиною міграції. Вони не можуть
залишитися в окремій непідконтрольній системі або мовчки зникнути.

### 2.1. Інвентаризація і класифікація

- [x] Зібрати кандидати з frontend, backend, маршрутів і чинного каталогу.
- [x] Виявити дублікати та технічні UI-кліки.
- [x] Отримати з актуальної БД повний список старих активних і неактивних
  permission definitions, aliases та всіх `RolePermission` призначень.
  Read-only inventory на `ConcordDb_EventPermissionsCurrent`: 157 active і
  1 deleted legacy definitions, 1098 active legacy role links; alias rows
  штатно перейшли з pre-sync 156 до post-sync 158 після додавання двох
  mappings Tax Free. Перевірка не зберігає імена/ідентифікатори ролей в
  artifact.
- [x] Для кожного старого ключа зафіксувати рівно один статус:
  `same_canonical`, `alias_to_canonical`, `split_to_canonical`,
  `merged_into_canonical`, `inactive_orphan`, `requires_product_decision`.
  Поточний результат: 157 `alias_to_canonical`, 1
  `split_to_canonical`, 1 `inactive_orphan`, 0 невідомих активних ключів.
- [x] Жоден старий ключ не може залишитися без явного mapping/status.
- [x] Результат mapping зберігати як відтворюваний versioned artifact і
  перевіряти в CI.
  Code-owned version `2026.08.20.1` та snapshot
  `gba-server/docs/event-permission-legacy-mapping.v1.json` містять 159
  dispositions; default contract перевіряє snapshot drift, required SQL gate
  — точну повноту definitions/aliases/active links актуальної test-only БД.

### 2.2. Правила сумісності

- [x] Нові призначення ролям зберігаються канонічними ключами.
- [x] Читання й перевірка доступу підтримують відомі legacy aliases.
- [x] Alias не створює окреме право в UI і не збільшує кількість канонічних
  definitions.
- [x] Якщо старе право відповідає одному новому — перенести всі його рольові
  призначення на канонічне право без втрати доступу.
- [x] Якщо кілька старих ключів відповідають одному новому — об'єднати
  призначення і не створити дублікати `(RoleId, PermissionId)`.
- [x] Якщо одне старе широке право розділяється на кілька granular rights —
  виконати явно затверджений compatibility backfill, щоб чинні ролі не
  втратили доступ у момент релізу.
- [x] Старі orphan/stale definitions не видаляти автоматично: позначити
  неактивними, зберегти audit trail і видаляти лише окремою міграцією.
- [x] Legacy writers не повинні повторно створювати дублікати або обходити
  optimistic concurrency нової системи.
  Filtered unique active `(UserRoleID, PermissionID)` index блокує фізичний
  duplicate. До першого PUT legacy лишається compatibility input; після
  revision legacy rows не входять в effective state, тому старий writer не
  може обійти versioned canonical role state.

### 2.3. Міграція призначень ролей

- [x] Перед міграцією зафіксувати контрольні числа: definitions, active keys,
  aliases, roles, active role links і дублікати.
- [x] Виконувати backfill транзакційно та ідемпотентно.
  Explicit one-shot tool має exact database guard, serializable transaction,
  transaction-owned app lock, unique-index/duplicate preflight, dry-run
  rollback і окремий double-confirm apply.
- [x] Для кожного старого активного рольового призначення довести одне з двох:
  канонічне призначення створене/вже існувало або старий ключ залишається
  ефективним через задокументований alias.
- [x] Після міграції не повинно бути двох активних links для однієї пари
  роль–канонічний пермішен.
- [x] Повторний запуск синхронізації та backfill не змінює результат.
- [x] Rollback не видаляє історичні definitions або рольові призначення.
  Legacy links залишені active; dry-run завжди rollback, а apply лише додає
  або revive canonical links, тому старий backend продовжує бачити legacy.
- [x] Сформувати before/after reconciliation report для релізу.
  Test-copy report:
  `gba-server/docs/event-permission-legacy-reconciliation-current-2026-08-20.json`.

### 2.4. Acceptance criteria для старих прав

- [x] 100% старих ключів мають mapping/status.
- [x] 100% старих активних рольових призначень reconciled без мовчазної
  втрати доступу.
- [x] Користувач зі старим сумісним призначенням отримує відповідне канонічне
  право через `/permissions/me`.
  SQL fixture доводить legacy-only grant до revision, canonical response і
  policy allow; після versioned cutover та відкликання canonical key response
  і policy обидва deny, попри збережений active legacy row.
- [x] Адміністратор бачить у новому UI одну канонічну бізнес-дію, а legacy keys
  — лише як другорядну інформацію/aliases.
  Catalog API/editor повертають 479 canonical definitions без окремих legacy
  nodes; 158 legacy keys зберігаються лише в mapping/alias metadata і не
  збільшують UI count.
- [x] Після збереження ролі нова система не записує legacy key замість
  канонічного.
  First successful versioned PUT створює revision і є per-role cutover:
  подальші reads/policies використовують canonical links та dashboard page
  inheritance, а legacy links лишаються фізично active лише для rollback
  старого backend і більше не можуть повторно видати відкликане право.
  Якщо reconciliation вже створив canonical link, відповідний legacy alias
  не позначає його inherited: адміністратор може відкликати право вже першим
  versioned save, без проміжного повторного збереження.
- [x] Прямий API-запит дозволяється/забороняється однаково для мігрованого
  canonical assignment і підтримуваного legacy alias.
- [x] CI падає, якщо з'явився невідомий legacy key, alias без target, duplicate
  mapping або активне старе право без disposition.
  Єдиний дозволений multi-target mapping — зафіксований split старого
  `Додати\Видалити` для Tax Free carriers на окремі create/delete права.

## 3. UI `/users/roles`

- [x] Єдиний редактор «Подієві права»; старий редактор сторінкових прав
  видалений з UI та frontend bundle.
- [x] Спільна ліва панель ролей і двопанельний layout у чинному стилі.
- [x] Дерево секція → сторінка → група → конкретний пермішен.
- [x] Checked/unchecked/indeterminate для всіх рівнів.
- [x] Пошук, фільтри, select all, select visible, clear, save і cancel.
- [x] Loading/error/empty/retry стани.
- [x] Dirty guard при зміні ролі, таба, refresh і закритті сторінки.
- [x] Optimistic concurrency та коректний `409` state.
- [x] Lazy render і перевірка великого каталогу.
- [x] Після помилки збереження UI не показує хибний success.
- [ ] Формальний browser E2E: select role → save → refresh.
- [ ] Формальний browser E2E незалежних однойменних дій, modal-open/submit,
  row-click і context-menu action.

## 4. Backend, БД та API

- [x] Каталог definitions керується кодом.
- [x] Використано наявні `Permission`/`RolePermission`, без паралельної моделі.
- [x] Додані metadata, aliases та незалежна revision ролі.
- [x] API каталогу, effective permissions і role GET/PUT.
- [x] Транзакційний diff update та optimistic versioning.
- [x] Динамічний policy provider/handler і `RequirePermission`.
- [x] Ідемпотентна синхронізація каталогу.
- [x] Міграційні й opt-in SQL integration tests.
- [x] Перевірити й безпечно усунути legacy duplicate role links на актуальній
  БД — фізичних active duplicate pairs `UserRoleID+PermissionID` немає (`0`),
  duplicate ControlId/alias/revision та orphan links також `0`. Виявлені 156
  effective overlaps є canonical+legacy-alias парами у двох ролях, тому вони
  збережені як compatibility, а не видалені. Додано filtered unique index для
  active role links із fail-closed migration preflight; EF snapshot clean,
  migration contract 2/2 і transactional dry-run з rollback пройшли.
- [x] Прогнати required SQL integration на фінальній копії актуальної БД —
  `ConcordDb_EventPermissionsCurrent`, 2/2 SQL tests, exact cleanup.
- [x] Виконати reconciliation старих role assignments за розділом 2 на
  актуальній test-only копії. Після трьох pending migrations explicit apply
  створив 945 canonical links: event links `480 → 1425`, усі 1104 required
  canonical assignments для 12 ролей активні, legacy links лишилися `1098`,
  duplicates 0.
  Повторний dry-run: `AlreadyActive=1104`, `Created=0`, `Revived=0`.

## 5. Frontend guards і server enforcement

- [x] `PermissionProvider`, `usePermissions`, `Can`, page boundary і aliases.
- [x] Поступова міграція основних модулів на канонічні ключі.
- [x] Окремі scoped API façades не ламають shared legacy routes.
- [x] Mutation endpoints повторно перевіряють право на сервері.
- [x] Контрактні й authorization tests покривають реалізовані façades.
- [x] Додати єдиний cross-repository CI parity check:
  frontend keys = backend catalog keys = 479. Backend exporter читає фактичний
  code-owned каталог; frontend gate перевіряє дублікати, точний розмір і
  двосторонню різницю множин. Поточний результат: `479/479`, catalog version
  `2026.08.19.62`. Єдиний repository verification entrypoint:
  `npm run verify:event-permissions`; окремих CI manifest-файлів у цих двох
  репозиторіях немає, тому entrypoint готовий для виклику зовнішнім pipeline.
- [x] Довести binding для всіх реальних covered actions, де audit поки не має
  машинного `bindingEvidence`: `705/705`,
  `coveredWithoutBindingEvidence = 0`.
- [x] Фінальний authenticated HTTP matrix: 20/20 representative protected
  calls без права повернули `403`; після versioned assignment 6 canonical
  keys усі 20/20 пройшли authorization до `200` або business-validation
  `400`. Окремо підтверджені unauthenticated `401` і stale-version `409`.

## 6. Аудит і CI

- [x] 1902 candidate records класифіковані.
- [x] 822 technical UI records виключені.
- [x] 359 duplicate occurrences виключені.
- [x] 16 stale/aggregated records виключені.
- [x] Немає нерозібраних `reviewCandidates` у поточному snapshot.
- [x] Каталог перевіряє унікальність, naming, metadata, aliases і policies.
- [x] Відтворювані audit scripts і snapshot drift check.
- [x] Усі актуальні business/covered records мають визначене джерело; після
  фізичного видалення старого editor 1893/1902 audit records source-resolved,
  а 9 historical unresolved належать лише до виключених категорій і не є
  `reviewCandidates`.
- [x] Додати/підтвердити `bindingEvidence` для всіх covered records —
  705/705 мають evidence: 147 page-route records, 452 direct current-action
  records і 110 explicit reviewed overrides; CI invariant вимагає
  `coveredWithoutBindingEvidence = 0`.
- [x] Звести до поясненого нуля релевантні handler resolution gaps — усі 439
  records без binding evidence належать лише до виключених категорій;
  `coveredWithoutBindingEvidence = 0`, `reviewCandidates = 0`.
- [x] Додати CI-перевірку повноти legacy mapping із розділу 2.
  Versioned snapshot має 159 унікальних dispositions; contract і required SQL
  integration fail-closed перевіряють target keys, активні definitions,
  aliases, role links та відсутність невідомих активних legacy keys.

## 7. Фіналізація і rollout

- [x] Синхронізувати frontend branch з актуальним `main`.
- [x] Синхронізувати backend branch з актуальним `development`.
- [x] Повні frontend test, lint, typecheck, build і audit checks.
- [x] Повний backend build/test та `verify-event-permissions` у required SQL
  mode — 104/104 API/security/SQL та 17/17 actor authorization tests.
- [x] Підготувати fail-closed production rollout runbook і report template —
  `gba-server/docs/event-permissions-production-rollout.md` фіксує порядок
  backup → clone migration/REQUIRED SQL → production migration/backend/catalog
  → reconciliation → frontend → smoke → cohorts/monitoring → decision;
  machine-readable template стартує `pending` і не дозволяє підмінити
  production acceptance тестовими receipt. Contract tests 2/2.
- [ ] Backup і dry-run міграцій на фінальній копії актуальної БД.
- [ ] Deploy order: БД/міграції → backend → catalog sync → frontend.
- [ ] Smoke test `/users/roles`, effective permissions та representative `403`.
  Read-only fail-closed runner реалізований у
  `gba-server/tools/Gba.EventPermissionRuntimeSmoke`: тільки GET, redirects
  disabled, response-size limit, exact 479-key/catalog-version parity, role
  state, `/permissions/me`, anonymous `401` та representative `403`.
  Його end-to-end loopback self-check пройшов
  `200/401/200/200/200/403`; production receipt закривається після deploy.
- [ ] Поступове призначення ролям і моніторинг authorization failures.
  Telemetry готова: authenticated event-permission deny пише structured
  warning `46001/EventPermissionDenied` з canonical key, user NetUID, method
  і path без query/body/token. Runbook baseline/cohort/stop conditions:
  `gba-server/docs/event-permissions-rollout-monitoring.md`. Фактичне
  production-призначення ролям і observation window ще не виконані.
- [ ] Зафіксувати before/after/rollback release report.
  Поточний перевірений checkpoint уже зафіксовано в
  `docs/event-permissions-release-checkpoint-2026-08-20.md`; фінальний report
  закривається після production rollout.

## Поточний етап

**Етап 6 — legacy integration і одноразовий cutover — завершений. Нова
система працює у strict runtime на локальному стенді; production acceptance
і rollout ще очікуються.**

Поточний підетап від 2026-08-20:

- [x] Повна legacy inventory/classification — 159 історичних ключів у union
  definitions+aliases мають явний status: 157 alias, 1 split, 1 inactive
  orphan. Два раніше unmapped активні права Tax Free carriers інтегровані:
  `Завантаження документів` → document export, `Додати\Видалити` → explicit
  create+delete split; обидва мали по 6 активних role links.
- [x] Versioned mapping artifact і CI completeness gate — code version
  `2026.08.20.1`, deterministic JSON snapshot, default contract та required
  SQL inventory test пройшли.
- [x] Physical reconciliation на актуальній test-only копії — migrations
  застосовані до exact target; unique filtered index активний, duplicates 0.
  Dry-run rollback розрахував 945 inserts; double-confirm apply створив їх,
  `480 → 1425` active event links при збережених 1098 legacy links. Повторний
  dry-run дав `1104 already active / 0 create / 0 revive`. Explicit tool не
  підключений до API startup і збирається єдиним CI verifier. SQL acceptance
  також довів staged per-role cutover: aliases діють до першого PUT, після
  revision роль читається й редагується canonical-only без втрати rollback
  legacy rows.

- [x] Frontend audit/typecheck/lint/full tests/build — 16 matrix audit tests,
  4 parity tests і 2564 Vitest tests пройшли; production build успішний.
- [x] Backend event-permission verification і Release build — required SQL
  mode: API/security/SQL 104 passed, 0 skipped; actor authorization 17 passed.
- [x] Перевірка runtime-каталогу — API повернув 479 active definitions,
  479 unique keys, 79 сторінок, 238 груп і 0 записів без required metadata.
- [ ] Browser acceptance для role save/refresh, незалежних дій і `403/409` —
  runtime API acceptance вже пройшла: GET → PUT → GET, незалежні однойменні
  ключі, version 0→1→2, unauthenticated `401`, authenticated insufficient
  role `403` і stale `409`; frontend `/users/roles` та його API proxy
  повертають `200`, proxy бачить 479 definitions. Формальна click-through
  UI-автоматизація очікує відновлення локального browser-control plugin.
- [x] Відтворюваний post-deploy runtime smoke runner — read-only tool бере
  URL, два bearer tokens, role NetUID і denied GET path лише з env, не слідує
  redirects, не виконує POST/PUT/PATCH/DELETE і друкує secret-free JSON
  receipt. Deterministic local HTTP self-check: catalog 479 exact keys,
  statuses `200/401/200/200/200/403`; focused behavioral/contract tests 6/6,
  CI-neutral verifier 108 passed + 4 SQL skipped при вимкненому Docker,
  actor authorization 17/17.
- [x] Rollout denial telemetry і stop contract — handler emit-ить лише
  authenticated event-permission denials як structured warning
  `46001/EventPermissionDenied`; query string, body та authorization header не
  потрапляють у подію. Monitoring contract/runbook tests 2/2, full
  CI-neutral verifier 108 passed + 4 SQL skipped, actors 17/17.
- [x] Production rollout/report contract — ordered fail-closed runbook і
  deliberately pending JSON template містять exact commits/target/backup,
  migration, catalog 479/version, reconciliation receipts, runtime smoke,
  monitoring, rollback та explicit decision fields. Template перевіряється
  проти code-owned catalog/mapping/EventId; focused tests 2/2.
- [x] Виправлення знайдених дефектів та повторний regression — виправлено
  застарілий contract-тест незалежних прав авто/шляхових листів; focused 5/5
  і повний backend verifier пройшли; runtime API acceptance також зелена.
- [x] Cross-repository catalog parity — додано backend exporter і frontend CI
  gate; виправлено 27 ключів, які існували в backend-каталозі, але не входили
  до frontend effective key set. Фінальний результат: 479 унікальних backend
  keys = 479 унікальних frontend keys, без missing/extra/duplicates.
- [x] Required SQL gate на актуальній test-only копії —
  `ConcordDb_EventPermissionsCurrent`; migration seed і transactional role
  read/update/conflict/link-revival пройшли 2/2 з exact cleanup. Повний
  `verify-event-permissions` у REQUIRED mode: 104/104 + 17/17.
- [x] DB duplicate/index gate — physical duplicates `0`; 156 intentional
  canonical+alias overlaps збережені. Нова filtered unique migration має
  preflight `THROW 51003`, exact `dbo` schema і успішний transactional dry-run;
  post-rollback index/history залишилися незмінені.
- [x] Upstream sync — актуальні `origin/main` і `origin/development` злиті в
  окремі `codex/event-permissions` гілки; обидві мають `0 behind`. Три
  frontend-конфлікти поєднали upstream folder-tree/comment logic із
  permission-scoped API. Backend merge пройшов автоматично. Після merge:
  frontend 2564/2564, backend verifier 94+17, parity 479/479.

Legacy integration, role reconciliation, code-owned catalog, API/UI
enforcement, runtime smoke runner, denial telemetry і production runbook
завершені. Нова масова генерація пермішенів не потрібна: основний каталог
містить 479 унікальних активних прав і має повний frontend/backend parity.

Залишок — не розробка каталогу, а фактичний **Етап 7**: відновити browser
click-through, зробити backup/dry-run на фінальній production-копії, виконати
deploy у зафіксованому порядку, запустити read-only smoke, поступово призначити
ролі з моніторингом і заповнити фінальний release report.

## 8. Аудит і підготовка вимкнення старої логіки (2026-08-24)

- [x] Повторно інвентаризувати legacy runtime paths у frontend, API,
  Analytics, БД та старому role/page editor.
- [x] Підтвердити ControlId mapping/reconciliation: 159/159 status,
  1098 active legacy links, 1104 required canonical assignments, 945 created,
  0 create/revive на повторному dry-run.
- [x] Видалити API compatibility flag і runtime alias/page-route fallback:
  GET/PUT/policy читають лише точні active canonical `RolePermission`.
- [x] Видалити frontend compatibility flag, aliases, profile `ControlId`
  fallback та GBA/Admin bypass; без `/permissions/me` клієнт fail-closed.
- [x] Замінити останні дві реальні перевірки відкриття sale wizard зі старого
  edit PKEY на `sales.ukraine.sale.open_create_dialog`.
- [x] Оновити strict contract tests; frontend full regression 2554/2554,
  typecheck/lint/production build green; backend event-permission suite
  113 passed + 4 opt-in SQL skipped.
- [x] Вирівняти Analytics authorization з main API: старий handler знято з
  DI, активний canonical handler використовує однакові config/revision gates.
- [x] Додати ідемпотентний `UserRoleDashboardNode` → canonical page
  reconciliation; unmapped/empty routes входять у receipt, strict gate може
  fail-closed.
- [x] Інтегрувати catalog sync + legacy/page reconciliation у штатний
  Database.Migrator з default-on postflight, 479 active/unique gate і
  secret-free JSON receipt; ручний SQL на іншому ПК не потрібен.
- [x] Прибрати останній dynamic frontend `*_PKEY` fallback для невідомих
  client type/role; unknown значення fail-closed.
- [x] Видалити старе відображення «Права сторінок» і його frontend API/types/
  selection utils; canonical editor «Подієві права» є єдиною вкладкою.
- [x] На актуальній disposable БД виконати штатний migrator: 16 ролей
  зафіксовано revision, 462 page assignments матеріалізовано; повторний запуск
  дав `cutoverRoles=0`, `Created=0`, `Revived=0`.
- [x] Оновити API/UI стенд `localhost:18084` і browser-перевіркою підтвердити,
  що `products.assortment.image.delete/upload` активні та перемикаються.
- [x] Прибрати UI-блокування `InheritedPermissionKeys`: obsolete wire field
  ігнорується, усі 479 canonical checkboxes редаговані за наявності права
  `administration.roles.event_permissions.edit`.
- [x] Старі role/page та permission-definition mutation routes повертають
  `410 Gone`; runtime більше не використовує старі writers.
- [x] Спрощено створення/редагування ролі: у модалці залишено тільки поле
  `Найменування`; технічні `Dashboard` і `UserRoleType` не показуються, але
  на edit зберігаються без змін, а для нової ролі застосовуються штатні
  defaults.
- [x] Виправлено накладання active-marker на олівець у лівому списку ролей:
  крапка має окрему позицію перед edit action. Focused UI regression 2/2,
  lint і production build пройшли; результат перевірено на
  `localhost:18084/users/roles` у браузері.
- [x] Формальний browser E2E на тимчасовій ролі: create → `0/479` → assign
  `dashboard.overview.page.view` → save → full refresh → persisted `1/479` →
  rename через модалку з одним полем → delete. Тимчасову роль і призначення
  повністю прибрано; робочі ролі не змінювалися.
- [ ] Після production rollback window окремою погодженою міграцією можна
  архівувати legacy definitions/links; strict runtime від них уже не залежить.

Повний звіт:
`docs/event-permissions-legacy-cutover-audit-2026-08-24.md`.

Commit-to-running deployment:
`gba-server/docs/event-permissions-clean-deploy.md`.

## 9. Повний release-аудит перед передачею модуля (2026-08-24)

Поточний статус: **code checkpoint зафіксовано логічними commit у гілках
`codex/event-permissions`**. Required-SQL, migrator ×2, DB postflight і
runtime API acceptance завершені; фінальний release verdict залишається
pending до browser E2E та owner-рішення для `11` financial create routes.

- [x] Frontend/backend catalog alignment — catalog розширено до `490`
  canonical permissions, version `2026.08.24.65`; додані окремі high-risk
  keys для cross-owner SaleReturn create/cancel і mutation завершеного
  SupplyOrder. Фінальний parity gate `490/490/490` PASS.
- [x] Повні frontend tests, lint, typecheck і production build —
  `466/466` files, `2598/2598` tests PASS у стабільному режимі
  `--maxWorkers=4 --testTimeout=10000`; lint/build PASS; catalog parity
  `490/490/490`, reviewed matrix `1902/1902`.
- [x] Поточний safe-checkpoint backend security/contract — після retirement
  legacy routes та exact-policy cutover повний non-SQL API regression має
  `944` PASS, `0` FAIL, `8` opt-in SQL skipped (`6` event-permission і `2`
  financial). Повний Security suite:
  `232` PASS, `0` FAIL, `6` opt-in SQL skipped; release gates для
  multi-context routes та exact/legacy policy intersections тепер зелені.
  Останній API Release build: `0 warnings / 0 errors`; actor authorization
  regression: `65/65` PASS.
- [x] Required-SQL integration на актуальній test-only БД: перший прогін
  виявив два transaction/idempotency дропери; після fix `6/6` PASS.
- [x] Штатний migrator clean-deploy і повторний idempotency run. Перший receipt:
  `490/490`, `276` elevated links, `5` role-upgrade links, `3` applied roles і
  `3` revision bumps. Другий receipt: pending migrations `0`, created/revived
  `0`, applied upgrades `0`, revision bumps `0`.
- [x] DB postflight: latest migration
  `20260824145922_AddRoleEventPermissionCatalogUpgrade`, catalog `490/490`,
  active duplicate groups `0`, active revision duplicate groups `0`, filtered
  unique index active, v4 markers `3`; Administrator/GBA/HeadSalesAnalytic
  мають рівно по одному active `convert_merged_to_bill` grant.
- [x] Runtime API acceptance: anonymous `401`, limited-user `403`, catalog і
  `/permissions/me` `200`; role GET/PUT/stale PUT/restore/GET =
  `200/200/409/200/200`, початкові `53` assignments повністю відновлені,
  revision contract `+2` підтверджено.
- [ ] Browser E2E на фінальному `490` runtime: edit role name, permission
  save, refresh і відновлення збереженого стану без впливу на production.
  Попередній formal E2E на checkpoint `479` пройшов. Фінальний runtime `490`
  піднято на `localhost:18084`, але дозволений browser runtime двічі не зміг
  ініціалізувати локальні kernel assets; це єдиний технічний blocker UI E2E.
- [x] Додано deterministic compiled-IL gate і checked-in manifest для всіх
  permission facade → public routed core edges, включно з async state
  machines. Початковий discovery checkpoint: `464` cores = `37`
  exact-gated + `347` single-context ungated + `79` multi-context ungated +
  `1` retired; `0` unresolved. Будь-яка непогоджена зміна route/key/edge або
  classification тепер падає в CI.
- [x] Усі початкові single-context routed cores автоматизовано закриті exact
  key; після переведення частини facade-ів на private fixed-context cores і
  погодженого retirement актуальний compiled-IL manifest має `458` edges =
  `380` exact-gated + `78` retired, `0` single-context, `0` multi-context,
  `0` unresolved. Manifest regenerated і drift-contract PASS.
- [x] Після явного owner approval усі `77` multi-context legacy cores
  відключено через HTTP `410`; підтримуваних Console callers немає,
  permission OR між контекстами не додано. Generic
  `/usermanagement/profiles/all/by` retired окремо, тому manifest містить
  загалом `78` retired routes; focused route regression `8/8` PASS.
- [x] Усі нефінансові frontend generic callers перенесені на exact facades:
  Resale, Sales registry, Pricing, SAD-to-order, Outgoing та Other Income.
  Deterministic route contract `3/3` PASS; allowlist скорочено з `17` до `11`.
  Залишилися лише `11` financial mutation literals (`income/new` ×6,
  `outcome/new` ×5), які очікують явного owner approval. Глобальна заміна або
  permission OR між контекстами заборонені.
- [x] Після явного owner approval усунуто всі `586` old-role-policy
  intersections на `1182` exact-protected actions. Видалено `13`
  controller-level і `438` method-level legacy attributes; старий захист
  перенесено на `35` ungated public actions у mixed controllers, тому ще не
  мігровані маршрути не стали відкритими. Повторний deterministic dry-run:
  `0` intersections / `0` changed files; non-SQL API regression
  `944/944` PASS. Самі permission definitions і role links не видалялися.
- [x] Перевести live navigation/route guard з `UserRoleDashboardNode` на
  canonical `*.page.view`, прибрати GBA bypass і legacy dashboard writer.
  Додано focused canonical-navigation contracts — `4/4` разом зі strict
  migrator defaults PASS.
- [x] Виправити semantic gaps: ProtocolAct generic multi-context routes
  retired/split на private cores; SaleReturns high-risk overrides отримали
  окремі exact keys; completed SupplyOrder mutation використовує order-domain
  key; Delivery generic details виправлено на page-view key. API Release
  build `0/0`, focused semantic/actor suites PASS (`14/14`, `18/18`, `6/6`).
- [x] Security remediation без breaking retirement: SEC01/02 закрито exact
  Edit gate на generic Sales update/file; SEC04 закрито server-owned storage
  context; SEC05 — вузькою actor/ledger/eligibility mutation; SEC06 —
  persisted payment-graph policy; SEC08/10 — retired identity writers та
  exact role-details key; supported SEC09 lookup тепер zero-parameter,
  server-fixed `FinanceDirector`, active-only і без PII. Незалежна
  ревалідація: `7 CLOSED / 2 PARTIAL / 1 OPEN`, нових high/critical немає.
- [x] Після breaking approval critical legacy sinks
  `/sales/get/shifted/document`, `/supplies/invoices/delete/document` і
  `/usermanagement/profiles/all/by` повертають HTTP `410`; підтримуваний
  Console працює через exact facades.
- [x] Після явного owner approval додано одноразовий v4 grant high-risk
  `sales.ukraine.sale.convert_merged_to_bill` ролям Administrator, GBA і
  HeadSalesAnalytic через upgrade
  `2026.08.25.exact-policy-intersection-cutover.v4`. Focused migrator contract:
  `7/7` PASS; повторний запуск idempotent.
- [ ] Отримати явне підтвердження власника на exact cleanup `25` test-only DB
  link changes.
- [x] Clean-deploy/rollback/runtime runbook звірено з catalog `490` і всіма
  upgrade steps v1-v4.
- [ ] Фінальний release verdict з exact commits і відомими ризиками.

### 9.1. Зафіксовані code commits

Backend (`D:\\work\\gba-server`, `codex/event-permissions`):

- `b8f825725` — canonical catalog, auth runtime, DB/migrator та v4 grant;
- `1afac15df` — actor/domain authorization hardening;
- `96585af3c` — exact API gates, legacy HTTP 410 та policy cutover;
- `27c9a962b` — deployment/rollback runbooks.
- `9ea0e9762` — ambient transaction support і required-SQL idempotency fix.
- `4282ba7cd` — catalog `490` rollout/runtime runbook update.

Frontend (`D:\\work\\gba_console`, `codex/event-permissions`):

- `4061be85` — canonical runtime, navigation і role editor UI;
- `a5ef53dc` — feature routes та UI guards на exact permissions;
- `99ed7621` — reviewed matrix і validation tooling;
- `7b250e32` — dependency security patches.
- `2345ea25` — cutover/release checkpoint documentation.
