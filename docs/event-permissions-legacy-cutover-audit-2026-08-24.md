# Аудит старої логіки пермішенів і готовності до cutover

Дата: 2026-08-24
Гілки: `codex/event-permissions` у `gba-server` і `gba_console`

> **Фінальний strict-cutover статус, 2026-08-24 16:00.** Цей блок є
> актуальним підсумком і замінює опис проміжного compatibility-етапу нижче.
> Старий текст залишено як хронологію аудиту, а не як поточну інструкцію.

## Фінальний результат

- [x] Frontend runtime використовує тільки canonical keys із
  `/permissions/me`; profile `ControlId`, aliases, fail-open і GBA/Admin
  bypass видалені.
- [x] API й Analytics authorization перевіряють тільки точний active
  `RolePermission` до active `Permission.Kind=Event`; alias/page/revision
  fallback та elevated bypass видалені.
- [x] Catalog synchronizer більше не створює aliases і не роздає GBA-права
  під час runtime read.
- [x] Штатний Database.Migrator виконує legacy/page materialization тільки
  для ролей без canonical revision, після чого створює revision.
- [x] На `ConcordDb_EventPermissionsCurrent` перший запуск дав
  `cutoverRoles=16`, `cutoverRevisionsCreated=16`, `dashboard.Created=462`;
  повторний — `cutoverRoles=0`, `Created=0`, `Revived=0`.
- [x] Старий frontend role editor, його API/types/utils і UI tab фізично
  видалені. Старі HTTP mutation routes збережені лише як явні `410 Gone`
  contracts без виклику legacy writer; `UserPermissionsActor` більше не
  створюється у runtime actor tree.
- [x] UI більше не читає `InheritedPermissionKeys` як причину блокування:
  усі canonical checkboxes редаговані за наявності
  `administration.roles.event_permissions.edit`.
- [x] Live browser на `localhost:18084` підтвердив, що
  `products.assortment.image.delete` і `.upload` мають `enabled=true`;
  delete checkbox перемкнувся `true → false → true` без save.
- [x] Каталог і parity: backend `479`, frontend `479`, missing/extra/duplicate
  keys — `0`, catalog version `2026.08.19.62`.
- [x] Audit matrix: 1902/1902 classified, 822 technical UI, 359 duplicate,
  16 stale/aggregated, 705 covered, `reviewCandidates=0`.
- [x] Frontend: 462 test files / 2554 tests, lint, typecheck, production build
  і `verify:event-permissions` — green.
- [x] Backend event-permission suite: 113 passed, 4 opt-in SQL skipped,
  0 failed; API/Analytics/Migrator Release builds — green.

Невирішене перед production: зберегти backup/production receipt, прийняти
рішення щодо 6 історичних unmapped dashboard routes, виконати формальний
browser save→refresh на окремій тестовій ролі та пройти observation window.
Legacy DB rows поки не видаляються для rollback/audit, але strict runtime їх
не читає.

## Висновок

Старі control-level permissions не втрачені: для всіх 159 історичних ключів
існує явний versioned disposition. На актуальній test-only копії 157 активних
legacy definitions із 1098 активними role links дали 1104 потрібні canonical
assignments для 12 ролей: 159 уже існували, 945 створено, після повторного
dry-run — 0 create і 0 revive. Фізичні дублікати відсутні.

Commit-ready deployment із compatibility default уже підготовлений. Штатний
`Global.Business.Assistant.Database.Migrator` після EF migrations автоматично
синхронізує повний каталог, переносить legacy ControlId links і матеріалізує
відомі `DashboardNode` page assignments. Analytics переведено на той самий
config/revision cutover contract, що й main API.

Підготовлений безпечний двофазний cutover: compatibility лишається ввімкненою
за замовчуванням, але API і frontend мають canonical-only режим для тестового
cohort. Старі рядки БД не видаляються й залишаються rollback-даними.

## Перевірена інвентаризація

| Показник | Результат | Доказ |
|---|---:|---|
| Canonical active catalog | 479 | catalog/parity gates |
| Legacy keys зі статусом | 159/159 | mapping `2026.08.20.1` |
| `alias_to_canonical` | 157 | mapping artifact |
| `split_to_canonical` | 1 | Tax Free create/delete |
| `inactive_orphan` | 1 | deleted key `c`, 0 active links |
| Active legacy definitions | 157 | required SQL inventory 2026-08-20 |
| Active legacy role links | 1098 | required SQL inventory 2026-08-20 |
| Ролі з legacy assignments | 12 | reconciliation receipt |
| Required canonical assignments | 1104 | reconciliation receipt |
| Already canonical | 159 | reconciliation receipt |
| Created canonical | 945 | reconciliation receipt |
| Active event links after apply | 1425 | reconciliation receipt |
| Повторний create/revive | 0/0 | idempotency dry-run |
| Active physical duplicates | 0 | filtered unique-index gate |

Джерела:

- `gba-server/docs/event-permission-legacy-mapping.v1.json`
- `gba-server/docs/event-permission-legacy-reconciliation-current-2026-08-20.json`
- `gba-server/tests/Global.Business.Assistant.Api.Tests/Security/EventPermissionsSqlIntegrationTests.cs`

## Де саме живе стара логіка

| Шар | Legacy path | Поточний стан | Cutover |
|---|---|---|---|
| Frontend auth | `UserRole.Permissions` змішувався з `/permissions/me` | compatibility mode | strict mode ігнорує profile permissions та fail-closed без endpoint |
| Frontend aliases | `PermissionAliases` перетворює старий `ControlId` на canonical | mapping/rollback metadata | strict mode приймає лише canonical runtime keys |
| Frontend business UI | дві точки створення продажу використовували `UkraineAllActOfEdit_Change_PKEY` | виправлено | використовують `sales.ukraine.sale.open_create_dialog` |
| Frontend clients | невідомий client icon/role раніше динамічно формував `*_PKEY` | виправлено | explicit canonical mapping; unknown fail-closed |
| API authorization | pre-revision role може отримати canonical право через alias | контрольований bridge | після revision alias більше не видає доступ; global strict flag вимикає bridge до revision |
| API page rights | `UserRoleDashboardNode` route дає canonical page permission | контрольований bridge | після revision page route більше не re-grant-ить право; потрібен mass-reconciliation сторінок |
| `/permissions/me` | compatibility response додає alias strings | контрольований bridge | strict backend повертає лише canonical keys |
| Elevated roles | `GBA`/`Administrator` мають повний доступ у frontend і API | навмисний чинний invariant, не legacy alias fallback | не змінювати без окремого product/security рішення |
| Analytics | старий handler завжди читав aliases/page routes | старий handler знятий з DI; активний canonical handler використовує config + revision | strict узгоджений з main API |
| БД | 1098 active legacy links фізично збережені | rollback data | не видаляти до завершення rollback window |
| Старий UI таб | «Права сторінок» | вимкнений compile-time gate; код лишено тільки для rollback | у новому UI доступний лише canonical editor «Подієві права» |

## Зміни, підготовлені цим аудитом

### Backend API

- Додано `EventPermissions:LegacyFallbackEnabled`, default `true`.
- При `false` alias і `DashboardNode` fallback не беруть участі в role/effective
  reads та authorization.
- При `false` `/permissions/me` повертає лише canonical keys.
- Page-route inheritance тепер, як і alias inheritance, припиняється після
  появи `RoleEventPermissionRevision`.
- Перший versioned PUT зберігає canonical snapshot; його readback більше не
  позначає вже матеріалізовані права як inherited.
- Штатний Database.Migrator автоматично запускає catalog sync, legacy role
  reconciliation і DashboardNode page reconciliation після EF migrations.
- Postflight перевіряє рівно 479 active/unique catalog rows, є ідемпотентним і
  друкує secret-free JSON receipt.
- Для строгого deployment gate є
  `DatabaseMigrations__FailOnUnmappedDashboardRoutes=true`.

Production-style environment key:

```text
EventPermissions__LegacyFallbackEnabled=false
```

### Frontend

- Додано `VITE_EVENT_PERMISSIONS_LEGACY_COMPATIBILITY`.
- Default — compatibility enabled, тобто deployment не змінює доступ сам по
  собі.
- Значення `disabled` робить `/permissions/me` єдиним джерелом event rights,
  відкидає profile-only/alias-only keys і fail-closed при недоступному endpoint.
- Дві реальні точки відкриття sale wizard переведено зі старого edit key на
  canonical `sales.ukraine.sale.open_create_dialog`.
- Dynamic unknown client type/role більше не генерує довільний `*_PKEY` і
  fail-closed без explicit canonical mapping.
- Старий role editor «Права сторінок» вимкнений через явний compile-time gate,
  canonical «Подієві права» відкриваються за замовчуванням, а старі dashboard
  modules більше не завантажуються сторінкою ролей.

Build-time key для тестового strict frontend:

```text
VITE_EVENT_PERMISSIONS_LEGACY_COMPATIBILITY=disabled
```

## Що навмисно не вимкнено

- Legacy definitions/RolePermission rows — потрібні для rollback старого
  backend.
- Старі role/page API routes — UI їх більше не викликає; backend endpoints
  лишено для rollback, а їх видалення є окремим compatibility release і
  не доводить коректність role migration.
- Повний доступ ролей `GBA`/`Administrator` — збережено симетрично у frontend
  та main API; це окрема бізнес-політика, а не залишок ControlId migration.
- Default compatibility flags — перший deployment лишається rollback-safe;
  strict стає окремим рішенням після live migration receipt і cohort smoke.

Це не «забутий код», а контрольований rollback bridge. Він має бути видалений
після завершення migration window, не до нього.

## Тести та результати

Виконано 2026-08-24:

- Backend API Release build: `0 warnings`, `0 errors`.
- Backend focused cutover/reconciliation: `4 passed`, `4 SQL skipped`, `0 failed`.
  Наявний test-only SQL container знайдено без створення нових image/volume,
  але SQL suite не запускалася без явно переданого test connection secret;
  credential із Docker metadata не витягувався. Це не зараховано як live proof.
- Backend full permission verifier: API/security `112 passed`, `4 SQL skipped`,
  `0 failed`; actor authorization `17/17`; tools build — `0 warnings`,
  `0 errors`.
- Frontend strict/compatibility auth suite: `20/20 passed`.
- Frontend application typecheck: passed.
- Frontend full regression: `463` test files, `2569/2569` tests passed.
- Legacy role UI contract: old «Права сторінок» tab is absent, canonical
  «Подієві права» is visible by default, and dashboard modules are not loaded.
- Frontend ESLint: passed.
- Frontend production build: passed; є лише штатне Vite warning про chunks
  понад 500 kB, не пов'язане з permission changes.
- `git diff --check`: passed на обох репозиторіях.

У повному frontend regression також є вже наявні non-fatal warnings тестового
середовища (`act(...)`, Node `localStorage`, відсутній TypeScript sourcemap,
nested button у наявному DataTable). Вони не дали жодного failed test і не
походять зі змінених permission-файлів, але винесені сюди, щоб green результат
не приховував технічний борг test harness/UI markup.

Попередній live SQL доказ від 2026-08-20 залишається валідним для legacy
ControlId inventory/reconciliation: `104/104` required SQL/API/security і
`17/17` actor authorization. Він не перевіряє новий Analytics/page strict
cutover, тому цей сценарій треба повторити після запуску test DB.

## Ризики

### Medium — потрібен live receipt unmapped dashboard routes

Page reconciliation реалізований у штатному migrator і матеріалізує всі
відомі canonical page routes. Невідомі/порожні routes не губляться: вони
потрапляють у JSON receipt, а compatibility bridge продовжує їх обслуговувати.
Перед strict default потрібен live прогін із fail-on-unmapped gate.

### Medium — live strict SQL/E2E ще не виконаний

Немає дозволеного test connection string. Через це немає нового live доказу
для page cutover, Analytics і повного role cohort після змін цього аудиту.

## Оцінка

| Напрям | Оцінка | Коментар |
|---|---:|---|
| Повнота legacy ControlId mapping | 9/10 | 159/159 класифіковано, active links reconciled |
| Canonical catalog/UI/API | 9/10 | 479/479 parity, typed catalog і versioned role API |
| Rollback safety | 9/10 | legacy rows не видаляються, compatibility default on |
| Page-permission cutover | 8/10 | automatic reconciliation готовий; потрібен live unmapped receipt |
| Cross-host authorization | 9/10 | main API й Analytics мають однаковий config/revision gate |
| Commit-ready compatibility deployment | **9/10** | один migrator, без ручного SQL, rollback bridge збережено |
| Поточна готовність до global strict | **7/10** | код готовий; потрібен live gate і cohort observation |

## Обов'язковий порядок подальшого переносу

1. Запустити штатний Database.Migrator на актуальній disposable/target копії
   та зберегти JSON receipt; повторний запуск має дати 0 create/revive.
2. Повторити REQUIRED SQL suite з connection string, переданим через secret.
3. Для strict cutover повторити migrator із fail-on-unmapped gate.
4. Увімкнути strict API/frontend/Analytics лише для тестового cohort і перевірити:
   role GET/PUT/refresh, `/permissions/me`, representative `403`, Analytics
   report endpoint, сторінки та однакові legacy/canonical користувачі.
5. Порівняти denial telemetry `46001/EventPermissionDenied` до/після.
6. Лише після green observation зробити strict default.
7. Після rollback window окремим релізом видалити dead frontend legacy exports,
   alias response expansion, старі endpoints і фізичні legacy links.

Rollback strict-mode тесту: повернути backend flag у `true`, перебудувати
frontend без значення `disabled`; legacy rows залишаються на місці.

Відтворювана інструкція іншого ПК:
`gba-server/docs/event-permissions-clean-deploy.md`.
