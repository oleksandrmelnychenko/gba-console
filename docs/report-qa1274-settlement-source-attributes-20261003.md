# QA1274: джерельні реквізити у взаєморозрахунках

## Оригінальна форма

Незмінний XLS QA1274: SHA256 `b1934c4887bd6486b057557e676c87f4d554c3a1e1d945baa84eab46da9e75ea`, 238080 байтів. У BIFF8 row 6 B записано «Додаткові поля»; row 10 B–D: «Контрагент», «Основний менеджер покупця», «Код по региону». Це дві додаткові колонки біля контрагента. Вони не змінюють фінансове зерно ClientAgreement, валюту договору або групування Організація / Валюта / Контрагент.

Фактичні суми старого XLS не є вимогою для поточних даних. Інші відбори оригіналу, конкретні saved selections і всі додаткові оригінальні варіанти потребують власного підтвердження.

## Наявний нормальний шлях даних

Fenix `ClientsSyncRepository` уже читає `_Reference68._Fld1130` як RegionCode і `_Fld1118RRef` як ManagerSourceId; ім’я — точний `_Reference100._Description` через цей reference. `UpsertClientSourceSnapshot` зберігає їх у `ClientSourceSnapshot` разом із SourceSystem/SourceID/SourceCode, validity/truncation/deletion flags, ManagerReferenceObserved і LastSeenAtUtc. Поле `_Fld1129RRef`/RegionName означає інший реквізит і не підставляється замість «Код по региону».

Нові читання використовують наявний OUR SNAPSHOT фінансового звіту. Джерельний alias договору зберігається: якщо потрібен physical buyer alias, відсутній alias не замінюється canonical buyer. Для supplier family ці buyer-атрибути не позичаються. Local MainManagerID та RegionCodeID не використовуються. Нових Source-запитів, producer flags, міграцій чи бізнес-записів немає.

## Контракт і поведінка

- Dataset 41, groupedSettlementPeriod Version 1, Fenix: додані filters 60 SourceBuyerManager і 61 SourceBuyerRegionCode. Старі layouts [4,41,76] / [4,76] і чотири суми 88–91 залишаються.
- Capabilities додають SourceAttributeWorlds=[Fenix] та AdditionalFields з двома точними заголовками. AMG не рекламує ці відбори у формі; його менеджер reference/observation не доведений.
- Lookup: існуючий permission-protected GET `/report/datasets/lookup`, dataSource=41, field=60/61, sourceWorld=1. Manager key — exact captured reference, region key — lossless UTF16 code, NULL має окремий key. Це не локальні UserID/RegionID. Наявне observed unassigned manager має окремий choice.
- Labels не joinяться за іменем. Два менеджери з однаковим caption мають різні keys. NULL/порожній/пробільний/різний регістр/кінцеві пробіли коду регіону зберігаються окремо; SQL групує точні байти + DATALENGTH. Порожній видимий текст choice отримує пояснювальний підпис; raw additional field не змінюється.
- Missing, duplicate, invalid, truncated або contradicted evidence залишається unknown. Активний невизначений attribute filter не створює відомих сум: рядок зберігається з NULL financial basis. Boolean AND/OR зберігає три значення. Disabled filters відсутні.
- Inline preview: optional SettlementCounterpartyAttributes з row SourceIndex, availability/null flags, InputSha256 та тим самим ResultSha256. Hash включає реальні captured attribute proof; дані не прикріплюються до іншого рядка.
- XLSX пише дві колонки між row axes та сумами; subtotal/grand total використовують наявні ClientAgreement bases. PDF проходить існуюче перетворення цього самого workbook. Справжній preview/XLSX/PDF та authenticated browser acceptance ще не виконані.
- Existing caller capture, abort/CSRF/file guards збережені. Lookup додатково перевіряє того самого caller після await; зміна джерела або відбору інвалідує попередні результати у звичайному потоці Console.

## Авторські випадки й межі

Server settlement: 29 pure declarations (22 evidence/filter/projection/export + 7 route/service) і 1 disposable OUR SQL integration declaration. Один наявний capability case уточнений без зміни кількості. Console: 18 доданих declarations (10 data, 3 API, 3 render, 2 workspace). Cash попередній окремий компонент має 7 server + 6 Console declarations. У цьому FILE handoff нічого не запускалося.

Нова disposable SQL case використовує тільки нову test database, реальні schema migrations і production lookup/reader SQL; перевіряє exact text distinctions, distinct manager identities, відмову marked evidence, caller snapshot ownership/rollback та cleanup. Production OUR/Source не змінюється автором.

Native parity, повна готовність даних, saved original variants, authenticated generation/export, QA1276 scrollbar і full task acceptance не заявлені. 195 inventory / 27 DCS defaults залишаються окремим повним inventory scope; вони не перетворюються на 195 доведених QA1274 вимог.
