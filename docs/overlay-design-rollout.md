# Перенесення дизайну вікон — 18.10.2026

Статичний огляд усіх JSX-викликів: **264 AppModal, 122 AppDrawer, 1 AppBottomSheet**.
Прямих викликів Mantine Modal/Drawer поза спільними оболонками не знайдено.
Ці числа означають місця використання в коді, а не кількість перевірених вручну станів.

## Спільні правила

- AppDrawer / AppModal: компактні шапки, заголовки mono 16/600, закриття 32px,
  єдині відступи, сірі другорядні кнопки, білі секції з тонким бордером.
- DocumentDetail: компактний вигляд тепер у базовому CSS, зокрема для секцій,
  використаних без DocumentDetailLayout. Старі градієнтні смуги та метрики
  в окремих коробках видалено. Підписи над значеннями, статуси й дати у чіпсах.
- Адаптація карток за шириною контейнера: вузький шит на великому екрані
  також переходить на компактну сітку.
- Широкі горизонтальні таби — активна оранжева кнопка; вузькі — прокручування.
- Повідомлення — спільні компактні семантичні банери через theme Alert.
- Старі форми використовують міст стилів sheet-surfaces.css.

## Перевірені локальні винятки

- Підзвітні витрати: прибрано власний вкладений скрол, висоту від viewport
  та додатковий правий відступ. Скролом керує AppDrawer.
- Договори, паспорт постачальника, протоколи доставки: локальні classNames
  змінюють вміст та інпути; спільна геометрія шапок збережена.
- Налаштування накладної, редагування продажу: спільний footer і сірий фон.
- Експорт: збережена спеціалізована шапка й вибір формату, без tutorial-блоку.
- NewSaleWizard: свідомо залишений workspace з власною навігацією та захистом
  незбереженого замовлення. Не додаємо другу шапку поверх його шапки.
- WizardReviewConfirmModal: відсутність хрестика та блокування Escape — частина
  підтвердження, не стилістичний виняток.
- Нижній шит: збережено жест та рівні висоти; відступи, заголовок і хрестик
  вирівняні зі спільним патерном.

## Покриття за модулями

| Модуль | Модалки | Праві шити | Нижні шити |
|---|---:|---:|---:|
| accountable-expenses | 1 | 1 | 0 |
| accounting-banks | 2 | 0 | 0 |
| accounting-cash-flow | 0 | 1 | 0 |
| act-providing-services | 1 | 2 | 0 |
| act-reconciliations | 2 | 2 | 0 |
| advanced-reports | 0 | 2 | 0 |
| ai-fleet | 1 | 0 | 0 |
| assortment | 0 | 1 | 0 |
| available-payments | 2 | 2 | 0 |
| basket-supply-ukraine-order | 6 | 2 | 1 |
| client-resources | 12 | 0 | 0 |
| clients | 18 | 5 | 0 |
| company-cars | 3 | 1 | 0 |
| consumable-orders | 3 | 3 | 0 |
| consumable-products | 4 | 0 | 0 |
| consumable-storages | 3 | 2 | 0 |
| currency-convertors | 1 | 2 | 0 |
| depreciated-orders | 2 | 1 | 0 |
| document-outcome-payment | 1 | 0 | 0 |
| header-actions | 2 | 0 | 0 |
| income-cashflows | 3 | 5 | 0 |
| incomplete-sales-online-shop | 1 | 1 | 0 |
| online-shop-cities | 2 | 0 | 0 |
| online-shop-seo | 5 | 2 | 0 |
| organisation-services | 0 | 1 | 0 |
| organization-clients | 3 | 2 | 0 |
| outgoing-cashflows | 7 | 4 | 0 |
| payment-accounts | 3 | 1 | 0 |
| payment-cashflow-articles | 1 | 1 | 0 |
| payment-expense-articles | 1 | 1 | 0 |
| payment-online-shop | 1 | 1 | 0 |
| product-capitalizations | 3 | 2 | 0 |
| product-delivery-protocols | 17 | 8 | 0 |
| product-groups | 1 | 1 | 0 |
| product-income-documents | 1 | 3 | 0 |
| product-placements | 2 | 0 | 0 |
| product-remains | 0 | 2 | 0 |
| product-specification-codes | 2 | 1 | 0 |
| product-storages | 0 | 2 | 0 |
| product-transfers | 2 | 1 | 0 |
| products | 5 | 2 | 0 |
| reports | 46 | 0 | 0 |
| resales | 1 | 5 | 0 |
| sad | 11 | 0 | 0 |
| sales-cockpit | 7 | 0 | 0 |
| sales-debtors | 0 | 1 | 0 |
| sales-offers | 3 | 1 | 0 |
| sales-online-shop | 1 | 3 | 0 |
| sales-preorders | 1 | 0 | 0 |
| sales-returns | 3 | 5 | 0 |
| sales-ukraine | 19 | 10 | 0 |
| shared/sale-audit | 1 | 0 | 0 |
| shared/ui | 1 | 2 | 0 |
| supplier-organizations | 2 | 4 | 0 |
| supply-returns | 0 | 1 | 0 |
| supply-ukraine-orders | 12 | 6 | 0 |
| supply-ukraine-payment-protocols | 2 | 3 | 0 |
| tax-free-carriers | 2 | 2 | 0 |
| tax-free-documents | 3 | 1 | 0 |
| tax-free-pack-lists | 9 | 1 | 0 |
| transporters | 3 | 0 | 0 |
| users | 4 | 2 | 0 |
| vehicle-registry | 0 | 2 | 0 |
| warehouse-ukraine | 9 | 5 | 0 |

## Перевірки цього проходу

- TypeScript та production-збірка Vite — успішно; лишається стандартне попередження про розмір chunks.
- ESLint змінених TSX-файлів — успішно.
- 20 тестів у 6 файлах: AppDrawer, AppModal, AppBottomSheet, DocumentDetail,
  ProductIncomeDocumentDrawer, OneCTurnoverReportPanel — успішно.
- У браузері на тимчасовому локальному стенді перевірено широкий і вузький
  шити, модалку дій із довгим заголовком, нижній шит. На ширині 390px
  scrollWidth і clientWidth області шита дорівнюють 382px: горизонтального
  переповнення немає. Стенд і його вкладку після перевірки видалено.
- Повний ручний перегляд кожного бізнес-стану не виконувався: списки документів
  та підзвітних витрат залишалися в завантаженні під час цієї перевірки.
  Інвентаризація всіх викликів у коді не замінює E2E всіх бізнес-сценаріїв.
