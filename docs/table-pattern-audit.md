# Аудит патернів таблиць — 19.10.2026

Перевірка вихідного коду: `npm run audit:tables:check`. Повний перелік файлів і рядків: `node scripts/audit-table-patterns.mjs --json`.

Охоплено 164 файли: 183 використання/реалізації DataTable, 53 статичні таблиці та 1 спеціалізоване розкриття продажу. Невизначених реалізацій немає. Це інвентаризація коду, а не твердження, що кожний екран перевірено в браузері.

- DataTable лишається основою інтерактивних реєстрів: щільність, колонки, сортування, дії та розкриття.
- Статичні таблиці використовують `app-static-table` із `src/shared/theme/static-tables.css`: загальна геометрія, заголовки, роздільники, чергування рядків. Клас не додають до зовнішнього контейнера або до DataTable.
- Метадані — `TableChip`; клікабельність залишається на кнопці/посиланні. Суми й кількість залишаються звичайним текстом. Дати, назви та банківські реквізити не обгортаються автоматично.
- `SaleExpandContent` — усвідомлений виняток у реалізації: CSS grid із динамічними валютними/ПДВ-колонками та редагуванням знижок. Уніфіковано його відступи, збережено доступи та попередження.
- Збережено структуру звітних матриць: rowspan/colspan, групові й загальні підсумки, закріплені колонки, числове вирівнювання й точність. Стани змінених клітинок та редактори залишаються локальними.
- Список оферт тепер має спільні чіпси й TableRowAction; товари в розкритті — семантична таблиця. Прибрано клікабельний Badge на користь доступної кнопки причин.

## Реєстр за модулями

| Модуль | Файли | DataTable | Статичні | CSS grid |
| --- | ---: | ---: | ---: | ---: |
| accountable-expenses | 1 | 1 | 0 | 0 |
| accounting-banks | 1 | 1 | 0 | 0 |
| accounting-cash-flow | 2 | 2 | 0 | 0 |
| act-providing-services | 1 | 1 | 0 | 0 |
| act-reconciliations | 5 | 5 | 1 | 0 |
| advance-payments | 1 | 1 | 0 | 0 |
| advanced-reports | 1 | 1 | 0 | 0 |
| ai-fleet | 1 | 0 | 1 | 0 |
| assortment | 1 | 1 | 0 | 0 |
| available-payments | 2 | 4 | 0 | 0 |
| balances | 1 | 1 | 0 | 0 |
| basket-supply-ukraine-order | 6 | 10 | 1 | 0 |
| client-product-movement | 1 | 2 | 0 | 0 |
| client-resources | 1 | 1 | 0 | 0 |
| clients | 6 | 4 | 2 | 0 |
| company-cars | 2 | 2 | 0 | 0 |
| consumable-orders | 1 | 1 | 0 | 0 |
| consumable-products | 1 | 1 | 0 | 0 |
| consumable-storages | 1 | 3 | 2 | 0 |
| currency-convertors | 2 | 1 | 1 | 0 |
| depreciated-orders | 2 | 2 | 0 | 0 |
| income-cashflows | 3 | 3 | 0 | 0 |
| incomplete-sales-online-shop | 1 | 1 | 0 | 0 |
| online-shop-cities | 1 | 1 | 0 | 0 |
| online-shop-seo | 1 | 2 | 0 | 0 |
| organisation-services | 1 | 2 | 0 | 0 |
| organization-clients | 2 | 2 | 0 | 0 |
| outgoing-cashflows | 4 | 3 | 1 | 0 |
| payment-accounts | 2 | 2 | 0 | 0 |
| payment-cashflow-articles | 1 | 1 | 0 | 0 |
| payment-expense-articles | 1 | 1 | 0 | 0 |
| payment-online-shop | 3 | 3 | 0 | 0 |
| product-availabilities | 1 | 1 | 0 | 0 |
| product-capitalizations | 2 | 3 | 0 | 0 |
| product-delivery-protocols | 5 | 3 | 2 | 0 |
| product-groups | 3 | 3 | 0 | 0 |
| product-history | 1 | 1 | 0 | 0 |
| product-income-documents | 2 | 7 | 0 | 0 |
| product-placements | 1 | 2 | 0 | 0 |
| product-remains | 1 | 4 | 0 | 0 |
| product-specification-codes | 1 | 1 | 0 | 0 |
| product-storages | 1 | 2 | 0 | 0 |
| product-transfers | 1 | 2 | 0 | 0 |
| products | 2 | 8 | 3 | 0 |
| reports | 31 | 3 | 28 | 0 |
| resales | 1 | 6 | 0 | 0 |
| sad | 2 | 7 | 0 | 0 |
| sales-charts | 2 | 2 | 0 | 0 |
| sales-cockpit | 3 | 3 | 1 | 0 |
| sales-debtors | 1 | 1 | 0 | 0 |
| sales-geography | 1 | 1 | 0 | 0 |
| sales-offers | 2 | 0 | 2 | 0 |
| sales-preorders | 1 | 1 | 0 | 0 |
| sales-returns | 2 | 5 | 0 | 0 |
| sales-ukraine | 9 | 6 | 3 | 1 |
| shared/ui | 2 | 9 | 0 | 0 |
| shopping-cart-reserve | 1 | 2 | 0 | 0 |
| source-register-reports | 1 | 0 | 1 | 0 |
| supplier-organizations | 3 | 3 | 0 | 0 |
| supply-returns | 1 | 2 | 0 | 0 |
| supply-ukraine-orders | 4 | 8 | 0 | 0 |
| tax-free-carriers | 1 | 1 | 0 | 0 |
| tax-free-documents | 1 | 2 | 1 | 0 |
| tax-free-pack-lists | 2 | 3 | 0 | 0 |
| transporters | 1 | 1 | 0 | 0 |
| users | 1 | 1 | 0 | 0 |
| vehicle-registry | 1 | 3 | 0 | 0 |
| warehouse-ukraine | 9 | 10 | 3 | 0 |

## Межі візуальної перевірки

Оферти перевірено на окремому тимчасовому прикладі з довгою назвою, різними статусами, розкриттям, відсутніми значеннями та вузьким екраном 390 px. Приклад не входить у продукт. На живому маршруті `/sales/ukraine/offers` сторінка показувала помилку завантаження, тому реальні рядки цього маршруту в цьому проході не перевірені. Інвентаризація та автоматичні перевірки доповнюють, але не замінюють ручну перевірку всіх бізнес-сценаріїв.

## Автоматична перевірка

- `npm run audit:tables:check`: 0 невизначених реалізацій.
- `npm run build`: TypeScript і production-збірка успішні; лишається попередження про розмір великих chunks.
- 37 тестів: дії оферт, дозволи, API-контракти, чіпси, взаємодія рядків та підсумки звітів.
- `npm run lint`: 0 помилок, 4 попередження залежностей hooks у незмінених цим проходом `useAmgDiscountAnalysisChoices`, `useAmgDiscountAnalysisSelection`, `useAmgDiscountVariants`. `git diff --check`: успішно.
