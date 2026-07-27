# Канонічна модель бухгалтерії та план завершення

Дата фіксації: 2026-07-27.

## Статус

Серверне ядро платежів уже захищає основні зміни балансів транзакціями,
operation ledger, canonical reload і reversal/delta-проведенням. Консольні
маршрути бухгалтерії відкриваються на DEV, а профільні frontend і server
тести проходять.

Цього недостатньо для статусу «бухгалтерія завершена». Поточна функціональна
модель все ще змішує:

- факт руху грошей;
- документ, що створив борг або право на отримання коштів;
- платіжну задачу;
- аванс;
- авансовий звіт;
- SAD і TaxFree;
- бухгалтерський та управлінський облік.

Мета цього плану — мати одну економічну модель, над якою форми є лише
інтерфейсом. Ручне проходження форм лишається фінальним smoke, але не є
доказом фінансової коректності.

## Базові інваріанти

1. Гроші змінює тільки проведений платіжний документ, переказ або обмін.
2. Платіжна задача, SAD, TaxFree, накладна чи рахунок самі по собі не
   змінюють касу або банківський рахунок.
3. Один користувацький submit має одну operation identity. Повтор після
   timeout не проводить гроші вдруге.
4. Проведений документ не видаляється фізично. Виправлення — атомарне
   сторнування старого впливу та проведення нового.
5. Скасування використовує збережений серверний фінансовий snapshot, а не
   повторно обчислює історичну суму з поточних довідників.
6. Баланс рахунку дорівнює opening/source snapshot плюс усі активні postings.
7. Розподілена сума платежу не може перевищувати ані платіж, ані залишок
   зобов'язання.
8. Стаття руху коштів і стаття витрат — різні аналітичні виміри.
9. Каса, картка і банк — тип рахунку, а не окремий економічний тип операції.
10. Закритий бухгалтерський період, а не календарний день створення,
    визначає можливість сторнування або перепроведення.

## Канонічні операції

### Прибуткові

| Операція | Джерело | Рахунок | Партнерський стан |
|---|---|---:|---|
| Оплата покупця | продаж, рахунок або без розподілу | `+` | борг покупця зменшується або виникає аванс |
| Повернення від постачальника | повернення/корекція або без розподілу | `+` | борг/аванс постачальника коригується |
| Інший прихід від контрагента | довільне зобов'язання | `+` | змінюється рівно один канонічний договір |
| Інший прихід без контрагента | бухгалтерська підстава | `+` | без партнерського руху |
| Повернення від підзвітної особи | аванс співробітника | `+` | підзвітний залишок зменшується |

### Видаткові

| Операція | Джерело | Рахунок | Партнерський стан |
|---|---|---:|---|
| Оплата постачальнику | задача, накладна, послуга або без розподілу | `-` | борг зменшується або виникає аванс |
| Повернення покупцю | повернення/переплата | `-` | борг/аванс покупця коригується |
| Інший платіж контрагенту | довільне зобов'язання | `-` | змінюється рівно один канонічний договір |
| Інша витрата | бухгалтерська підстава | `-` | без партнерського руху |
| Видача підзвітній особі | аванс співробітника | `-` | підзвітний залишок збільшується |

### Двосторонні операції

Переказ між рахунками та обмін валют є окремими агрегатами. Вони не повинні
створювати незалежні прибутковий і видатковий ордери двома HTTP-запитами.

Переказ проводить в одній транзакції:

```text
source register -= source amount
target register += target amount
```

Обмін додатково зберігає:

- source currency та source amount;
- target currency та фактичний target amount;
- напрямок операції;
- застосований курс;
- точність і правило округлення;
- джерело та timestamp курсу.

Cancel сторнує ці збережені суми. Він не має повторно визначати напрямок за
поточним `Currency.Code`.

## Прибрані функціональні дублікати

### Повернення покупцю

Станом на 27.07.2026 залишено один канонічний маршрут:

- `/accounting/outgoing-cashflow/new/group?...operationType=6`;

Окрему форму й маршрут `/accounting/outgoing-cashflow/new/client-return`
видалено. Навігаційна policy блокує старий URL замість мовчазного відкриття
іншого сценарію.

### Оплата постачальнику

У консолі залишено один group-flow `SupplierPayment` із двома канонічними
джерелами:

- ручна оплата постачальнику;
- оплата за платіжними задачами.

Видалено окрему organization-payment форму, standalone payment-task redirect
і дублікати «поповнення балансу постачальника послуг» / «платіжна задача» з
меню. Замовлення витратних матеріалів підтягується як source у канонічній
формі, а не є новим видом руху грошей.

### Підзвіт

У формах уже розділено:

- видачу коштів співробітнику;
- повернення невикористаних коштів;
- авансовий звіт;
- витратні рядки авансового звіту.

Форма видачі під звіт тепер завжди вимагає співробітника та створює тільки
`TransferToColleague`; прихований перемикач, який дозволяв зробити з неї
звичайну витрату, видалено. Видача/повернення змінюють гроші та підзвітний
баланс. Авансовий звіт розподіляє вже видані кошти на витрати й не повинен
повторно списувати касу.

## SAD і TaxFree

### Фактичний поточний стан

Активний `AdvancePayment` workflow видалено 27.07.2026. Він містив amount,
VAT, організацію, договір і посилання на SAD/TaxFree, але не мав платіжного
рахунку, валюти рахунку або register posting. Тому він не був доказом
фактичного руху грошей.

З консолі видалено кнопки, payload builders і POST API. Із сервера видалено
create/update routes, mutation actor, write-policy, messages та SQL
insert/update. Історичні рядки залишилися доступними тільки через агрегований
authenticated list GET для аудиту; невикористаний detail endpoint теж
видалено. Нові SAD/TaxFree рухи грошей створюються лише як прибутковий або
видатковий платіжний ордер із реальною касою/рахунком.

### Цільова модель

```text
SAD / TaxFree
    -> FinancialObligation або AccountingAccrual
    -> optional PaymentTask
    -> PaymentOrder
    -> PaymentAllocation
    -> Open / PartiallySettled / Settled / Cancelled
```

SAD/TaxFree відповідає за суму та підставу зобов'язання, але не за спосіб
платежу. Каса/банк, стаття руху й дата платежу належать платіжному ордеру.

Історичний `AdvancePayment` класифікований як non-posting source document:
його сума не входить у register balance і він не є доказом оплати. Якщо
бізнесу потрібне окреме ПДВ-нарахування, воно має бути додане новою
канонічною сутністю `AccountingAccrual`, а не відновленням старого
write-path. Передоплата створюється звичайним проведеним `PaymentOrder`.

## Цільові сутності

### FinancialObligation

Зберігає:

- direction: receivable/payable;
- organization;
- counterparty та agreement;
- document, agreement і base currency;
- original, settled і remaining amounts;
- source type та immutable source identity;
- status.

### PaymentAllocation

Зберігає:

- payment order;
- financial obligation;
- amount у валюті платежу;
- amount у валюті зобов'язання;
- rate snapshot;
- created/cancelled metadata.

Для `Sale/ReSale` вже використовується канонічний
`IncomePaymentOrderSale`: many-to-many, active-only reads, mutation locks,
DB XOR/numeric/unique constraints і єдиний header-source переплати. Потрібна
additive V2-модель лише для універсальних income/outcome obligations,
FX/provenance snapshot і подальшого shadow comparison.

### AccountingSourceLink

Єдине посилання на джерело:

- source system;
- source entity type;
- source immutable ID/NetUid;
- source version або content hash;
- ownership mode: local/imported.

Воно замінює розкидану умовну поведінку за `TaxFreeId`, `SadId`, task IDs та
ознаками sync.

### MoneySnapshot

Для кожного проведеного руху:

- register currency amount;
- document currency amount;
- agreement currency amount;
- base/euro amount, якщо потрібен;
- rate, source, timestamp;
- canonical rounded deltas.

## Стани й CRUD

Цільовий lifecycle:

```text
Draft -> Posted -> Cancelled
             \-> ReversedAndReposted
```

- `Draft` не змінює баланси.
- `Post` виконує document + allocations + agreement deltas + register
  postings + operation ledger в одній транзакції.
- Зміна проведеного документа є reversal/repost, а не blind update.
- `Cancel` одноразовий та ідемпотентний.
- Фізичного delete для фінансових документів немає.
- Довідники, які вже використані, архівуються замість delete.

## ПДВ та аналітичні статті

ПДВ не повинен бути довільним полем кожної форми руху грошей.

- Для платежу за invoice/service VAT приходить із source obligation.
- Для unmatched payment VAT або відсутній, або дозволений лише окремою
  operation policy.
- Payment movement article описує cash-flow.
- Expense article описує P&L/management expense.
- Оплата вже визнаної товарної заборгованості не створює витрату повторно.

Створення статті з autocomplete треба винести в контрольовану дію з окремим
permission, нормалізацією назви й unique constraint.

## Платіжні задачі

Цільові стани:

```text
Draft -> WaitingApproval -> Approved -> PartiallyPaid -> Paid
                              \-> Cancelled
```

Задача:

- не змінює баланси;
- має canonical source та amount/currency;
- оплачується через `PaymentAllocation`;
- не дозволяє overpayment;
- merge/activate/cancel мають operation identity та audit trail.

## Синхронізація 1С

Для кожного aggregate визначається ownership:

- `Imported`: 1С є джерелом, GBA не переписує economic identity;
- `Local`: GBA створює outbox event для 1С;
- `Corrected`: correction має lineage до попередньої версії;
- `MissingAtSource`: не видаляється автоматично без доведеної lineage та
  absence policy.

Повтор sync не створює нового документа або posting. Source correction
атомарно сторнує попередній target і проводить новий.

## План реалізації

### Етап 0 — executable contract — виконано

1. Серверний operation catalog для всіх `OperationType`.
2. Консольний catalog маршрутів, назв і requirements без зміни API.
3. Contract tests, які падають при невідомому operation code, дубльованій
   семантиці або розходженні counterparty requirements.

### Етап 1 — прибрати дублікати без schema change — виконано

1. Один customer refund flow.
2. Один supplier payment flow з різними source selectors.
3. Payment task трактувати як source, а не operation.
4. Уніфікувати validators та payload builders.
5. Заборонити створення довідникової статті без окремого permission.

### Етап 2 — additive financial schema

1. `FinancialObligation`.
2. `PaymentAllocation` з allocated amounts.
3. `AccountingSourceLink`.
4. Persisted FX target amount/direction/rate snapshot.
5. DB constraints для numbering та active/main register invariants.

Нові таблиці спочатку заповнюються паралельно зі старими. Read-path не
перемикається до backfill і shadow-звірки.

### Етап 3 — SAD/TaxFree cutover

1. ~~Класифікувати `AdvancePayment` і прибрати активний write-path.~~
2. Backfill source obligations і source links.
3. Перевести нові SAD/TaxFree дії на obligation/allocation.
4. Порівнювати історичні та нові totals у shadow mode.
5. Після acceptance прибрати special payment endpoints з консолі.

### Етап 4 — єдина форма

Один `PaymentOrderForm`, конфігурований operation catalog:

- direction;
- counterparty type;
- agreement requirement;
- allocation/source requirement;
- VAT policy;
- accounting profile;
- available register types;
- validation messages.

### Етап 5 — sync та reconciliation

1. Source lineage/backfill.
2. Idempotent outbox/inbox.
3. Scheduled read-only balance reconciliation.
4. Alert на register drift, orphan allocation, overpayment і broken source
   link.

## Обов'язкові докази

### Чесна матриця на 27.07.2026

Позначення: `закрито` — реалізація і профільні автоматичні тести вже є;
`частково` — ядро є, але повний фінансовий цикл або production gate ще не
доведений; `не закрито` — потрібна нова модель, міграція або executable
proof.

| Контур | Стан | Наявний доказ | Що ще блокує 100% |
|---|---|---|---|
| Прибутковий ордер: create/update/cancel/reassign | закрито на рівні server core | actor/API/idempotency та balance-delta тести | повний browser CRUD усіх конфігурацій форми |
| Видатковий ордер: create/update/cancel | закрито на рівні server core і console contract | actor/API/idempotency, supplier/under-report/fuel safety тести; дублікати форм і маршрутів видалені | повний browser CRUD усіх канонічних конфігурацій |
| Каса/банк: posting і checkpoint | закрито | immutable posting, checkpoint, drift guard та reconciliation SQL | production scheduler/alert і organization-level authorization |
| Продаж → борг → оплата → повернення | частково | disposable API+SQL suite для UAH/EUR і cross-currency payment | suite зараз не є обов'язковим CI gate і не охоплює всі operation types |
| SAD/TaxFree external income/outcome | частково | canonical source lock, installment/overpayment та cancel safety тести; non-posting `AdvancePayment` переведено в read-only archive | немає універсального obligation/allocation lifecycle і source-link backfill |
| Часткові й багатоцільові алокації | частково | `IncomePaymentOrderSale` підтримує many-to-many `Sale/ReSale`; один канонічний update/cancel, active-only reads, row locks і DB constraints | немає універсальної income/outcome obligation-моделі, allocation FX/provenance snapshot і обов'язкового live SQL concurrency gate |
| Обмін валют | закрито на рівні server core | атомарний create/cancel, register-delta тести; immutable target, currency IDs, джерело/час курсу, calculation і rounding snapshot | browser proof |
| Переказ між рахунками | частково | атомарність, idempotency і source-lineage тести | legacy lineage backfill та production shadow comparison |
| Opening balance нового рахунку | закрито на рівні server core | create має operation identity, replay ledger, точність суми та posting/checkpoint guard | browser proof і production organization scope |
| Платіжна задача | частково | canonical task ownership/status/payment-link safety | немає універсального partial allocation lifecycle |
| 1С payment/register sync | частково | snapshot reconcile, replay/correction і publication тести | source-register lineage/backfill та destructive absence policy ще не введені |
| Нумерація та active/main constraints | частково | окремі writers мають locks | потрібні DB unique constraints і заміна всіх `last + 1` |
| Console unit contract | закрито для поточного operation catalog | completeness, route/menu mapping, payload validators і duplicate-route regression | browser CRUD лишається окремим gate |
| Browser proof | не закрито | DEV read-only route smoke | немає committed Playwright financial-cycle suite на disposable DB |

Disposable financial-cycle suite вже існує в server tests, але в поточному
середовищі `FINANCIAL_CYCLE_API_INTEGRATION_CONNECTION_STRING` не заданий.
Тому її наявність не можна подавати як свіжий зелений прогін. Перед статусом
«готово» release pipeline мусить запускати її з
`FINANCIAL_CYCLE_API_INTEGRATION_REQUIRED=1`; skip у release-перевірці має
бути помилкою.

### API/actor

Для кожної операції:

1. create;
2. exact replay;
3. same key + different payload conflict;
4. update/repost;
5. cancel;
6. concurrent equal requests;
7. canonical counterparty/agreement ownership;
8. wrong currency/register/organization rejection;
9. over-allocation rejection;
10. rollback при помилці вкладеного рядка.

### SQL integration

Для кожного сценарію перевіряються:

- register amount;
- posting checkpoint;
- client/supplier/accountable balance;
- obligation remaining amount;
- allocation sum;
- task state;
- document state;
- operation ledger.

Канонічний цикл:

```text
initial
-> create 100
-> update 120
-> partial allocation 40 + 60
-> correction 110
-> refund/reversal 90
-> cancel
-> exact initial state
```

### Console/Vitest

- operation catalog completeness;
- route-to-operation mapping;
- conditional required fields;
- currency/rate snapshot payload;
- no duplicate customer-refund/supplier-payment paths;
- mutation operation identity survives unknown outcome;
- backend validation error is visible and does not navigate to success.

### Playwright

На disposable test tenant/database:

- усі канонічні операції;
- Cash/Card/Bank;
- UAH/EUR/USD/PLN;
- різні валюти рахунку й договору;
- partial payment;
- overpayment rejection;
- edit/repost/cancel;
- SAD/TaxFree source settlement;
- payment task partial/full settlement;
- 1С replay/correction;
- balance comparison through read API та direct SQL oracle.

Shared DEV використовується для read-only smoke. Destructive/concurrent
proofs запускаються лише на disposable SQL clone.

## Критерій завершення

Бухгалтерський scope можна назвати завершеним лише коли:

1. кожна економічна операція має один канонічний code/path;
2. source document, payment task, obligation і money movement не змішані;
3. усі balance effects мають durable posting і persisted money snapshot;
4. partial/multi-document allocations математично закриті;
5. cancel/repost повертає всі залежні стани;
6. 1С replay і correction не створюють дубля;
7. автоматичний API + SQL + Playwright proof проходить на чистій базі;
8. scheduled reconciliation не знаходить drift.
