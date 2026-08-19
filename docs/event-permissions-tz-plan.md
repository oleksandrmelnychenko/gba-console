# ТЗ і план: корпоративна система подієвих пермішенів

## Статус документа

- Робочі проєкти: `D:\work\gba_console`, `D:\work\gba-server`.
- Робочі гілки: `codex/event-permissions` у кожному репозиторії.
- UI керування ролями: `/users/roles`.
- Канонічний каталог: 479 активних подієвих пермішенів.
- Legacy aliases у поточному каталозі: 156.
- Останнє оновлення статусу: 2026-08-19.

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
- [ ] Отримати з актуальної БД повний список старих активних і неактивних
  permission definitions, aliases та всіх `RolePermission` призначень.
- [ ] Для кожного старого ключа зафіксувати рівно один статус:
  `same_canonical`, `alias_to_canonical`, `split_to_canonical`,
  `merged_into_canonical`, `inactive_orphan`, `requires_product_decision`.
- [ ] Жоден старий ключ не може залишитися без явного mapping/status.
- [ ] Результат mapping зберігати як відтворюваний versioned artifact і
  перевіряти в CI.

### 2.2. Правила сумісності

- [x] Нові призначення ролям зберігаються канонічними ключами.
- [x] Читання й перевірка доступу підтримують відомі legacy aliases.
- [x] Alias не створює окреме право в UI і не збільшує кількість канонічних
  definitions.
- [ ] Якщо старе право відповідає одному новому — перенести всі його рольові
  призначення на канонічне право без втрати доступу.
- [ ] Якщо кілька старих ключів відповідають одному новому — об'єднати
  призначення і не створити дублікати `(RoleId, PermissionId)`.
- [ ] Якщо одне старе широке право розділяється на кілька granular rights —
  виконати явно затверджений compatibility backfill, щоб чинні ролі не
  втратили доступ у момент релізу.
- [ ] Старі orphan/stale definitions не видаляти автоматично: позначити
  неактивними, зберегти audit trail і видаляти лише окремою міграцією.
- [ ] Legacy writers не повинні повторно створювати дублікати або обходити
  optimistic concurrency нової системи.

### 2.3. Міграція призначень ролей

- [ ] Перед міграцією зафіксувати контрольні числа: definitions, active keys,
  aliases, roles, active role links і дублікати.
- [ ] Виконувати backfill транзакційно та ідемпотентно.
- [ ] Для кожного старого активного рольового призначення довести одне з двох:
  канонічне призначення створене/вже існувало або старий ключ залишається
  ефективним через задокументований alias.
- [ ] Після міграції не повинно бути двох активних links для однієї пари
  роль–канонічний пермішен.
- [ ] Повторний запуск синхронізації та backfill не змінює результат.
- [ ] Rollback не видаляє історичні definitions або рольові призначення.
- [ ] Сформувати before/after reconciliation report для релізу.

### 2.4. Acceptance criteria для старих прав

- [ ] 100% старих ключів мають mapping/status.
- [ ] 100% старих активних рольових призначень reconciled без мовчазної
  втрати доступу.
- [ ] Користувач зі старим сумісним призначенням отримує відповідне канонічне
  право через `/permissions/me`.
- [ ] Адміністратор бачить у новому UI одну канонічну бізнес-дію, а legacy keys
  — лише як другорядну інформацію/aliases.
- [ ] Після збереження ролі нова система не записує legacy key замість
  канонічного.
- [ ] Прямий API-запит дозволяється/забороняється однаково для мігрованого
  canonical assignment і підтримуваного legacy alias.
- [ ] CI падає, якщо з'явився невідомий legacy key, alias без target, duplicate
  mapping або активне старе право без disposition.

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
- [ ] Перевірити й безпечно усунути legacy duplicate role links на актуальній
  БД; лише після аудиту вирішити питання DB unique index.
- [ ] Прогнати required SQL integration на фінальній копії актуальної БД.
- [ ] Виконати reconciliation старих role assignments за розділом 2.

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
  `2026.08.19.62`.
- [x] Довести binding для всіх реальних covered actions, де audit поки не має
  машинного `bindingEvidence`: `705/705`,
  `coveredWithoutBindingEvidence = 0`.
- [ ] Фінальний authenticated HTTP matrix: без права `403`, з правом запит
  проходить до бізнес-валідації.

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
- [ ] Додати CI-перевірку повноти legacy mapping із розділу 2.

## 7. Фіналізація і rollout

- [ ] Синхронізувати frontend branch з актуальним `main`.
- [ ] Синхронізувати backend branch з актуальним `development`.
- [x] Повні frontend test, lint, typecheck, build і audit checks.
- [ ] Повний backend build/test та `verify-event-permissions` у required SQL
  mode.
- [ ] Backup і dry-run міграцій на фінальній копії актуальної БД.
- [ ] Deploy order: БД/міграції → backend → catalog sync → frontend.
- [ ] Smoke test `/users/roles`, effective permissions та representative `403`.
- [ ] Поступове призначення ролям і моніторинг authorization failures.
- [ ] Зафіксувати before/after/rollback release report.

## Поточний етап

**Етап 5 — фінальна перевірка реалізованих 479 прав — у роботі.**

Поточний підетап від 2026-08-19:

- [x] Frontend audit/typecheck/lint/full tests/build — 16 matrix audit tests,
  4 parity tests і 2520 Vitest tests пройшли; production build успішний.
- [x] Backend event-permission verification і Release build — API/security
  contracts 94 passed, 2 opt-in SQL skipped; actor authorization 17 passed.
- [x] Перевірка runtime-каталогу — API повернув 479 active definitions,
  479 unique keys, 79 сторінок, 238 груп і 0 записів без required metadata.
- [ ] Browser acceptance для role save/refresh, незалежних дій і `403/409` —
  runtime API acceptance вже пройшла: GET → PUT → GET, незалежні однойменні
  ключі, version 0→1→2, unauthenticated `401`, authenticated insufficient
  role `403` і stale `409`; frontend `/users/roles` та його API proxy
  повертають `200`, proxy бачить 479 definitions. Формальна click-through
  UI-автоматизація очікує відновлення локального browser-control plugin.
- [x] Виправлення знайдених дефектів та повторний regression — виправлено
  застарілий contract-тест незалежних прав авто/шляхових листів; focused 5/5
  і повний backend verifier пройшли; runtime API acceptance також зелена.
- [x] Cross-repository catalog parity — додано backend exporter і frontend CI
  gate; виправлено 27 ключів, які існували в backend-каталозі, але не входили
  до frontend effective key set. Фінальний результат: 479 унікальних backend
  keys = 479 унікальних frontend keys, без missing/extra/duplicates.
- [ ] Upstream sync — frontend відстає від `main` на 2 commits і має 1
  overlapping file; backend відстає від `development` на 6 commits і має 2
  overlapping files. Merge/rebase не виконувався поверх незакоміченого
  verification checkpoint; потрібна окрема контрольована синхронізація.

Після завершення цього підетапу продовжити **Етап 6 — legacy integration,
закриття доказів аудиту та production release gate.**

Нова масова генерація пермішенів не потрібна. Основний каталог реалізований;
залишок роботи — довести повну інтеграцію старих прав і рольових призначень,
закрити перевірки та безпечно підготувати production rollout.
