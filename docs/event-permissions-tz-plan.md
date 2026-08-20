# ТЗ і план: корпоративна система подієвих пермішенів

## Статус документа

- Робочі проєкти: `D:\work\gba_console`, `D:\work\gba-server`.
- Робочі гілки: `codex/event-permissions` у кожному репозиторії.
- UI керування ролями: `/users/roles`.
- Канонічний каталог: 479 активних подієвих пермішенів.
- Legacy mapping у поточному каталозі: 158 distinct keys / 159 target
  bindings (один старий широкий ключ явно split на два canonical права).
- Останнє оновлення статусу: 2026-08-20.

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

- [x] Два повноцінні таби: наявні права і подієві права.
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
- [x] Розв'язати 74 `sourceUnresolved` records — автоматичний fail-closed
  resolver і 6 aggregate component→source bindings дали 1902/1902 resolved;
  missing source file або рівний score не маскуються випадковим вибором.
- [x] Додати/підтвердити `bindingEvidence` для всіх covered records —
  705/705 мають evidence: 147 page-route records, 452 direct current-action
  records і 110 explicit reviewed overrides; CI invariant вимагає
  `coveredWithoutBindingEvidence = 0`.
- [x] Звести до поясненого нуля релевантні handler resolution gaps — 431
  records без evidence належать лише до виключених категорій: 320
  `technical_ui`, 98 `duplicate_occurrence`, 13 `stale_or_aggregated`.
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

**Етап 6 — legacy integration і reconciliation — завершений. Етап 7 —
production acceptance і rollout — підготовлений, операційне виконання
очікується.**

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
