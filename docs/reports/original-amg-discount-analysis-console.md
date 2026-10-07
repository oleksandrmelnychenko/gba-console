# AMG · Аналіз знижок і націнок: власна форма за замовчуванням

## Історична форма без named choices (f0d5)

Форма запускається тільки для власного AMG original `0ac4605f-8ff9-4d0e-b694-8bdc55dc485a`, definition `168e4ef5787e1ec5e6d4a6a3ebfe5f9a002a6e28996661e550a5bc2778e7696a`. Власні маршрути: `GET /report/originals/amg/discount-analysis/capabilities` та `POST /report/originals/amg/discount-analysis/preview`. Наявний сервер не має для цієї форми маршруту choices або readiness.

Дата `Through` визначає зріз на останню цілу секунду обраного дня. Контрагенти розміщені в рядках, номенклатура — у стовпцях; для кожної пари показано `ТипЦен` і `ПроцентСкидкиНаценки`. Загальних підсумків і клієнтського обчислення MAX немає. Числове значення має точний підписаний рядок з трьома десятковими знаками; посилання з власною назвою, порожнє посилання та непідтверджений MAX залишаються різними станами.

Ця Console форма надсилає порожні `Counterparties` і `Products`, тобто формує весь доступний зріз. Обидва елементи відбору за назвами явно недоступні. Це корисна частина власного default2, а не завершення міграції відборів або збережених варіантів. Capability підтверджує реалізацію форми; повноту поточних звичайних даних та власний OUR Snapshot підтверджує лише відповідь preview.

Таблиця сторінкує лише відображення. CSV/XLSX/PDF використовують той самий завершений результат і точні рядки, без підсумків або скорочення матриці. Експорт очікує повних доступних ресурсів і назв; межа становить 16 384 стовпці та 1 000 000 клітинок файлу. Зміна дати, користувача, дозволу або навігація скасовує старі запити та відкладений експорт.

## Що потрібно для власних відборів і варіантів

Власний серверний DTO зараз приймає рівно `Version`, `World`, `SourceId`, `DefinitionSha256`, `Through`, `Counterparties`, `Products`. Обидва масиви містять унікальні великі 32-символьні hex RRef, максимум 256 на поле; порожній масив означає всі значення. `ChoicesWitnessSha256`, `From`, інші групування або перелік ресурсів не входять у цей контракт.

Потрібні власні AMG choices та перевірка свідчення обраного зрізу: повна множина контрагентів і товарів до застосування відборів, назви без opaque GUID-підписів, незалежна доступність полів, відмінність порожньої повної множини від відсутньої публікації. Свідчення має зв'язувати власні World/Source/definition/Through, повну множину ключів і ті самі шість поточних звичайних ревізій у власному OUR Snapshot. Preview повинен перевіряти актуальне свідчення, а Console — відкидати застаріле при зміні дати, користувача або публікації. Наявний контракт такого свідчення не приймає.

Наявна звичайна основа має власні AMG сімейства:

| Роль | Власний фізичний об'єкт |
| --- | --- |
| register | `_InfoRg13990` |
| product | `_Reference108` |
| client | `_Reference90` (`0000005A`) |
| agreement | `_Reference66` (`00000042`), включно з власником |
| price_type | `_Reference171` (`000000AB`) |
| characteristic | `_Reference182`, включно з власником |

Поточний reader використовує OUR `SourceReports.DiscountRegisterCurrent/Snapshot`, `DiscountReferenceCurrent/Snapshot` та власні `DiscountReportRows('amg', @DateEnd)` / `DiscountReferenceCurrentRows('amg', role)`. Потрібно підтвердити повне покриття назв власних client/product та agreement-owner/characteristic перед публікацією choices. Fenix `44/54` і AMG56 recipient `5A` не є свідченнями choices цієї форми.

Збережений варіант зможе містити тільки власну identity, дату та ці два масиви в межах чинного DTO; після завантаження потрібне оновлення власних choices і свідчення перед preview. Цей increment не додає збереження варіантів. Повна native сумісність параметрів дати, порядку MAX посилань і типів, поточна Source перевірка, data/export parity та `OriginalFullTaskAccepted` залишаються непідтвердженими.

## Перевірка цього increment

Авторовано 35 Vitest cases у 30 деклараціях і 5 нових spec-файлах. Старі test/spec файли з parent `759ef47` збережено байт у байт. Нейтральна таблиця матриці зберігає старі Fenix DOM, сторінкування і підписи; власний AMG API, нормалізація, ресурси та scope залишаються окремими. Автор не запускав Node, браузер, SDK, SQL, Docker або Source. Фактичні focused/lint/build/Doctor gates виконує Root після незалежного FILE review.

## Own named selectors (named successor)

The dedicated AMG API now supplies GET `readiness` and POST `choices` under `/report/originals/amg/discount-analysis`. The Console validates the exact own identity, full requested date and scope, Reference90/5A counterparties and Reference108/6C products, independent field availability, agreement/characteristic coverage and closed OUR Snapshot before using a current choices witness. Names remain searchable beyond the first 100 rendered entries; each selection accepts at most 256 distinct uppercase references.

Preview requires actual readiness. Available names can still be inspected when a whole publication or owner coverage is incomplete; a selected preview remains disabled until that coverage is complete. Date, caller, permission, names reload and navigation invalidate prior selections/results/exports. CSV/XLSX/PDF consume the exact completed own result including its witness, never a newly recomputed client result. Static capabilities retain false current Source/native parity flags.

The earlier unfiltered-only and missing-choices paragraphs describe the frozen f0d5 baseline. This successor implements the two own named selectors. The owner saved-variant successor is described below: the generic template payload is a dataset ReportsModel, so no own AMG request is saved into its owner list or deserializer. No Source/current-data/parity/runtime acceptance is claimed here.

## Owner saved variants

The own `/report/originals/amg/discount-analysis/variants` API stores only the captured date, distinct counterparty90/product108 references and fixed row/column/default-two measure shape. Console lists authenticated owner variants manually and opens an exact revision. Create, update and delete use revision CAS; an unavailable table stays visible. Scope normalizers reject a foreign identity, unsupported shape or retained publication witness. Name and revision never replace server owner authorization.

Opening a variant invalidates the completed result and obtains new own choices/readiness, even when the date is unchanged. Every saved reference remains intact until the current offered universe confirms it. A missing reference blocks execution and saving; clearing saved filters is an explicit user action. Current choices supply the preview witness, while saved JSON never supplies execution authority. Caller, permission, date and unmount cancellation reject late variant responses. Existing CSV/XLSX/PDF still use the same completed result.

This FILE feature is unexecuted. The additive own variant table migration1292, server publication readiness, all quality gates and deployment require Root runtime evidence. No Source connection, current-data or native-parity credit is implied.
