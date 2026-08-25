# Аудит UI-взаємодій і read-boundaries пермішенів — 2026-08-25

## Висновок

Система підтримує сценарій **«дані видно, але взаємодія недоступна»** через
окремі права на сторінку/список і на додаткові дані або бізнес-дію. Виявлено
та виправлено спільний UX-дефект: базові табличні компоненти показували
`cursor: pointer` навіть без переданого дозволеного row action.

Правило після аудиту:

1. `page.view` дозволяє завантажити й показати реєстр.
2. Окремий read-boundary (`open_details`, `view_audit`, `cash_flow.open`,
   `documents.open` тощо) дозволяє довантажити додаткові дані. Без нього
   рядок лишається видимим, але не має click/hover/pointer і не виконує API
   деталей.
3. Бізнес-пермішен (`create`, `edit`, `delete`, `export`, `print` тощо)
   одночасно контролює точку входу, форму/підтвердження, фінальний handler і
   серверний endpoint.
4. Modal/context-menu/dropdown/accordion/локальний row selection не мають
   окремого permission key. Технічний контейнер доступний лише тоді, коли
   доступна хоча б одна дочірня read- або business-capability.

## Покриття

- Повна reviewed event matrix: `1902/1902` подій, `0` review candidates.
- Після виправлень: `825 technical_ui`, `702 covered_existing`,
  `359 duplicate_occurrence`, `16 stale_or_aggregated`.
- Code-owned catalog: `499` versioned definitions, з них `495` активних і
  `4` явно retired технічних keys; catalog version `2026.08.25.67`.
- Статичний UI-зріз: `117` feature-файлів споживають shared `DataTable`,
  `68` feature-файлів містять row-click entry points, `40` сторінок мають
  прямі permission regression tests. Спільний контракт тепер діє для всіх
  `DataTable` consumers, а не виправляється по одній сторінці.
- Окремо перевірено всі `66` open-like ключів каталогу. `62` залишені як
  реальні read/business boundaries; `4` технічні контейнери retired.

## Retired технічні права

| Retired key | Нова поведінка |
|---|---|
| `sales.ukraine.sale.open_create_dialog` | Кнопка, wizard і submit використовують `sales.ukraine.sale.create`. |
| `sales.ukraine.sale.open_context_menu` | Меню існує лише за наявності хоча б однієї дозволеної дочірньої дії й лише якщо така дія допустима для конкретного продажу. |
| `orders.delivery_protocol.options.open` | Row click вмикається від `logistic_way.open`, `specification_codes.open` або `product_income.open`. |
| `warehouse_accounting.storages.position_action.open` | Вхід і submit використовують `position_action.management`; порожня оболонка більше не відкривається. |

Ключі не видаляються з історичної сумісності: у code-owned каталозі вони
залишаються з `Active=false`. Synchronizer детерміновано soft-delete-ить
відповідні DB rows, `/permissions/me` їх не повертає, а legacy mapping
переводить пов'язані старі технічні control IDs у `inactive_orphan`.
One-shot migrator також soft-delete-ить active `RolePermission` links і
`PermissionAlias` rows для retired canonical/legacy keys, тому в БД не
залишається прихованих активних призначень технічних прав.

## Збережені read-boundaries

Наступні класи не є «технічними кліками» і залишаються окремими правами,
бо вони відкривають дані, яких немає у базовому реєстрі:

- картка/деталі рядка: `*.open_details`, `*.open` з `tableRow` або
  `openDetails`;
- фінансові дані та рух коштів: `*.cash_flow.open`;
- аудит/історія/рух товару/залишки за партіями: `*.audit.open`,
  `*.movement.open`, `*.consignment_balances.open`;
- вкладки, drawer та right-view з окремим API payload;
- `products.assortment.write_off_rules.open`: показує наявні правила,
  окремо від `create` і `delete`;
- `orders.delivery_protocol.invoice_management.open`: зараз є чинною
  data/management boundary, а не порожньою оболонкою. Назва `open` і risk
  `medium` неідеальні; її можливе перейменування/split потребує окремої
  міграції призначень ролей і не робилось приховано в цьому cleanup.

## Реалізовані захисні контракти

- `DataTable`: row click handler, clickable class і pointer з'являються
  тільки коли consumer передав дозволену дію.
- `CashFlowGrid`: значення лишаються видимими; без жодного row callback
  рядок disabled, без pointer і без click.
- Sales Ukraine: порожнє меню дій не рендериться; доступність обчислюється
  також з поточного lifecycle конкретного продажу.
- Create Sale: усі три точки входу (Sales Ukraine, recommendations,
  sales cockpit) використовують один бізнес-ключ `sale.create`.
- Reviewed matrix більше не прив'язує технічні modal/context-menu events до
  retired keys.

## Перевірки

- Targeted frontend permission/interaction suite: `28/28` PASS.
- Backend catalog/rollout/cutover contracts: `88/88` PASS.
- Full frontend regression: `467/467` files, `2603/2603` tests PASS;
  lint і production build PASS.
- Permission snapshots/parity: candidates current, matrix `1902/1902`,
  parity `499/499`, catalog version `2026.08.25.67`.
- Full backend non-SQL regression після v6: `942/942` PASS; required event-permission
  SQL suite: `6/6` PASS.
- Migrator final cleanup + idempotency run PASS. SQL postflight:
  `495` active rows, `495` unique active keys, `4` retired technical rows,
  `0` active links і `0` active aliases до retired permissions.
- Live browser smoke після rebuild runtime PASS: `/users/roles` показує
  `495/495`, 4 retired keys не рендеряться; GBA не має `sale.create`, тому
  видима кнопка «Новий продаж» disabled. Role-boundary audit знайшов 7
  чинних ролей із `sale.view=true` та `sale.open_details=false`.
- Final v5 live addendum: GBA має `integration.gba_data.dataset.read`, а пошук
  історичного `Header_NewRemoveStatham_carriersAllView_PKEY` повертає
  `0/495`. Catalog/role reads виконуються після фізичного retirement legacy
  storage без fallback на aliases або dashboard links.
- Final v6 live addendum: `IdentityAdministrationPolicy` видалений; GBA має
  exact `administration.roles.page.view` і `administration.users.user.edit`.
  `/users/roles` лишився `495/495`, роль GBA має `494/495`, обидва v6 keys
  checked, Save disabled без локальних змін. Migrator повторний run дає
  `0` applied roles і `0` revision bumps.
- Окремий login-as-limited-role browser E2E з фактичним рядком продажу і
  подальшим grant/revoke залишається пунктом основного ТЗ; статичні,
  component, API-contract, SQL і read-only live gates завершені.
