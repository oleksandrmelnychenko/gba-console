# QA-план: перевірка форм на реквести (2026-07-21)

Мета: пройти всі форми консолі як Manual QA — кожен сабміт перевіряється по Network-табу (правильний ендпоінт/метод/тіло, статус, реакція UI на успіх і помилку).

Порядок прогону: **ТОВАРИ → СКЛАД → ПРОДАЖІ → ОБЛІК**. Середовище: dev (`localhost:5173` → проксі на gba-api-dev), тестовий акаунт `131313666`.

## Методологія (з аналізу apiClient/auth)

1) URL ЗАПИТІВ
- Формат: `{API_BASE_URL}/api/v1/{language}{path}?{query}` — функція `apiUrl()` у src/shared/api/apiClient.ts:62.
- `API_BASE_URL` = `VITE_API_BASE_URL` або `/` (src/shared/config/env.ts). У dev усе йде через Vite-proxy: `/api` → `https://gba-api-dev.85.17.167.167.nip.io`; ОКРЕМО `^/api/v1/[^/]+/(history|report)` → `https://gba-analytics-dev.85.17.167.167.nip.io` (інший бекенд для history/report!); `/hubs` (ws), `/Data`, `/Images` → основний api-target (vite.config.ts:71-103).
- Мова вбудована В ШЛЯХ, не в хедер: `VITE_API_LANGUAGE` або `uk` → у Network-табі шукати URL виду `/api/v1/uk/...`.
- Кожен запит несе хедер `X-Time-Zone: <IANA tz>` (напр. `Europe/Kyiv`) — src/shared/date/dateTime.ts:14.
- GET-дедуплікація: однакові одночасні GET (той самий URL+auth) шаряться в один мережевий запит (map `inFlightGetRequests`, apiClient.ts:80-184). У Network-табі QA побачить ОДИН запит там, де UI робить кілька однакових. Після відпадання всіх підписників GET абортиться через 50 мс (status “canceled” — це нормально). Жорсткий стеля на GET: 120 с, потім abort з помилкою «Сервер недоступний».

2) АУТЕНТИФІКАЦІЯ
- Cookie-based (`credentials: 'include'` на всіх fetch) + CSRF-токен у localStorage (ключ `gba_console_session`, поля csrfToken/userNetUid/user).
- CSRF-хедер: `X-CSRF-Token` — додається ТІЛЬКИ на unsafe-методи (POST/PUT/PATCH/DELETE), GET без нього (apiClient.ts:8, 362-364, 417-420).
- 401 на авторизованому запиті: спочатку ОДИН тихий refresh `POST /api/v1/{lang}/usermanagement/token/refresh` (тіло `{}`, з CSRF), успіх → повтор оригінального запиту (побачите в Network 401 → refresh → повтор). Невдача refresh АБО 403: `clearSession()` + подія unauthorized → AuthProvider робить `navigate('/login', {replace:true})`. Toast НЕ показується — просто викид на логін; сам запит кидає ApiError «Сесію завершено. Увійдіть повторно.»
- УВАГА: 403 (недостатньо прав) теж чистить сесію і викидає на логін — так само як 401.
- Відновлення сесії при завантаженні: `GET /usermanagement/token/session`, потім профіль `GET /usermanagement/profiles/get?netId=...`.
- Logout: `POST /usermanagement/token/logout` (помилки проковтнуті), локальна сесія чиститься завжди.

3) ОБРОБКА ПОМИЛОК
- ГЛОБАЛЬНОГО error-handler/toast НЕМАЄ (немає React Query, немає interceptor-нотифікацій). apiClient лише кидає `ApiError {status, payload, headers, message}` — показ повністю на совісті кожної сторінки/форми.
- Пріоритет тексту помилки: (а) `errorMessages[status]` передані викликом (для 5xx — fallback на `errorMessages[500]`); (б) поле `Message` з envelope-відповіді бекенда `{Body, Message, Status}` — тобто 400/409 зазвичай показують СИРИЙ текст бекенда; (в) для 401/403 — «Сесію завершено. Увійдіть повторно.»; (г) `errorMessages.default` або «Не вдалося виконати запит». Network-фейл: «Сервер недоступний. Спробуйте ще раз пізніше.» зі status=0.
- Показ у UI — два патерни впереміш: `notifications.show(...)` (Mantine toast, позиція top-right, ~518 викликів по коду) для успіхів, і локальний `setError` → `<Alert>` на сторінці для помилок (приклад ClientsPage). Немає єдиного стандарту — перевіряти кожну форму окремо.
- Валідаційних field-level помилок з бекенда НЕМАЄ: помилка завжди одним рядком (Message), не мапиться на конкретні поля форми.

4) LOADING / ПОДВІЙНИЙ САБМІТ
- Стандартного глобального захисту НЕМАЄ. Кожна форма сама тримає `isSubmitting`/`loading` на кнопці (Mantine `<Button loading>`). GET-дедуплікація в apiClient НЕ покриває POST/PUT/DELETE — подвійний клік по незаблокованій кнопці = два мутуючі запити. QA: перевіряти double-click на кожній кнопці збереження.

5) SIGNALR (реальний час, src/shared/realtime/RealtimeProvider.tsx)
- 6 хабів (WebSocket через Vite proxy `/hubs`): `/hubs/products/reservation` (резерви товарів, нові/оновлені продажі), `/hubs/supplies/orders` (замовлення постачання + toast «Оновлено замовлення» teal, «Нова платіжна задача» blue), `/hubs/exchangerates` (курси валют, 4 події), `/hubs/resale` (доступності resale), `/hubs/sales/cockpit` (задачі кокпіта продажів), `/hubs/data/sync` (прогрес синхронізації; toast помилки red autoClose:false — ТІЛЬКИ ролям Administrator/GBA).
- Тобто: оновлення продажів/резервів/курсів/кокпіта на екрані БЕЗ refetch — це SignalR, не баг і не polling. Auto-reconnect: 0/2/5/10/30 с; при reconnect data-sync звіряється через `GET /data/sync/status`.
- Toast'и teal/blue/red з top-right можуть з'являтися «самі по собі» — це пуші з хабів, не відповідь на дії користувача.

6) ЛОГІН-ФОРМА
- Файл: src/pages/login/LoginPage.tsx. Поля: `username` (TextInput «Логін», placeholder «ел. пошта або телефон», autoFocus), `password` (PasswordInput). Валідація мінімальна: тільки перевірка на порожні («Вкажіть логін і пароль»), без формату. Кнопка «Увійти» з `loading={isSubmitting}` — захист від подвійного сабміту Є.
- Запит: `POST /api/v1/uk/usermanagement/token`, JSON-тіло `{"Username":"131313666","Password":"<пароль>"}` (PascalCase!), без CSRF (auth:false), credentials:include. Відповідь має містити `CsrfToken` (+`UserNetUid`), інакше помилка «Сервер авторизації повернув некоректну відповідь».
- Тексти помилок: 400/401 → «Невірний логін або пароль»; 403 → «Недостатньо прав для входу»; 5xx → «Сервер тимчасово недоступний...»; мережа → «Сервер авторизації недоступний...». Показуються в red `<Alert title="Перевірте дані">` над формою (не toast).
- Після успіху: збереження сесії в localStorage → `GET /usermanagement/profiles/get?netId=...` → redirect `/dashboard`.

7) ГЛОБАЛЬНІ РИЗИКИ ДЛЯ ФОРМ
- НЕМАЄ таймаута на мутуючі запити (POST/PUT/DELETE) — тільки шаровані GET мають 120-с стелю. Завислий POST = вічний спінер на кнопці.
- 403 у будь-якому запиті = миттєвий викид на логін із втратою незбереженої форми (навіть якщо це просто «немає права на цю дію»).
- Помилки logout і `reconcileDataSyncProgressWithServer` проковтуються мовчки (catch → undefined).
- Помилка показу на совісті кожної форми: якщо розробник забув catch — помилка йде як unhandled rejection, користувач нічого не бачить.
- Порожнє тіло відповіді парситься як `null`; не-JSON тіло повертається сирим текстом — сторінки, що очікують об'єкт, можуть впасти на несподіваному форматі.
- `Message` бекенда показується користувачу як є — можливі англомовні/технічні тексти в UA-інтерфейсі на 400/409.
- Дві різні бекенд-адреси в dev (основний api vs analytics для history/report) — «сервер недоступний» може стосуватися лише одного з них.
- localStorage-сесія шариться між вкладками; logout/викид в одній вкладці через подію `gba-console-auth-session-changed` синхронізується тільки в межах вкладки (CustomEvent на window, не storage event) — інші вкладки дізнаються про розлогін лише при першому 401.

Ключові файли: /Users/oleksandrmelnychenko/gba-console/src/shared/api/apiClient.ts, /Users/oleksandrmelnychenko/gba-console/src/shared/auth/session.ts, /Users/oleksandrmelnychenko/gba-console/src/shared/config/env.ts, /Users/oleksandrmelnychenko/gba-console/src/features/auth/AuthProvider.tsx, /Users/oleksandrmelnychenko/gba-console/src/features/auth/api/authApi.ts, /Users/oleksandrmelnychenko/gba-console/src/pages/login/LoginPage.tsx, /Users/oleksandrmelnychenko/gba-console/src/shared/realtime/RealtimeProvider.tsx, /Users/oleksandrmelnychenko/gba-console/vite.config.ts

## Чекліст на кожну форму

1. Відкрити форму, зафіксувати lookup-GETи (довідники) — статуси 200.
2. Сабміт з валідними даними → у Network правильний `METHOD /api/v1/uk/...`, тіло відповідає полям, статус 200; UI: toast/redirect/refetch.
3. Сабміт з порожніми обовʼязковими полями → клієнтська валідація (disabled кнопка або помилки полів), запит НЕ йде.
4. Подвійний клік по кнопці → лише один запит (кнопка в loading).
5. Помилка сервера (якщо відтворюється) → зрозуміле повідомлення, форма не очищається.
6. Скасування/закриття → жодних запитів-сиріт, стан не ламається.

## Модуль ТОВАРИ — 16 сторінок, 51 форм

> Всі шляхи apiRequest реально збираються як /api/v1/{lang}{path} (lang за замовчуванням uk, VITE_API_BASE_URL). Нижче в requests вказано {path}; префікс /api/v1/uk додається автоматично.
> Відповіді розгортаються з envelope {Body,Message,Status}; ApiError несе серверне повідомлення — більшість форм показують його в inline Alert (не в notifications), тому при помилці у довгих drawer-формах алерт може бути поза видимою областю.
> Експорт документів усюди однаковий патерн: GET *export → модалка з посиланнями XLSX/PDF або одразу відкриття PDF у новому вікні (openPendingExportDocumentWindow) — перевіряти з увімкненим блокувальником попапів.
> /products/:netId — це ProductCarouselDeepLinkRedirect: редірект у каруселі /products?netId=...; окремої сторінки ProductDetailPage у роутері немає, її панелі (edit/images/specification/writeoff/movement/remains/storage-history/audit/analytics) відкриваються як ProductActionDrawer зсередини /products.
> deleteProductGroup (DELETE /products/groups/delete) є в API, але в UI ніде не викликається — видалення груп недоступне з інтерфейсу.
> Фільтри на /products/income/documents персистяться в localStorage (readStoredFilters/writeStoredFilters) — QA має перевірити відновлення фільтрів після перезавантаження.

### `/products` — Товари (пошук/асортимент)

- [ ] **Розширений пошук товарів** _(filter)_ — Поле пошуку + селектори режиму пошуку (0-5, дефолт 5) і сортування (0-2, дефолт 2); Enter/дебаунс 250мс; інфініті-скрол по 20
  - Поля: value (text); mode (select 0-5); sortMode (select 0-2)
  - Запит: `GET /products/search/advanced?limit&mode&netId={emptyGuid}&offset&sortMode&value — при вводі/зміні режимів і догрузці`
  - Запит: `GET /products/get?netId — deep-link /products?netId=...`
  - Запит: `GET /products/reservations/get/info?netId, GET /products/pricings/sources?netId — при виборі товару (деталі)`
  - Валідація: немає; порожній value дає загальний список
  - Успіх: рядки в каруселі/таблиці, вибраний товар підсвічується
  - Помилка: inline Alert з текстом помилки; 'Товар не знайдено' для битого netId
  - ⚠ сентінел netId=assortment не є GUID — перевірити, що не веде на 'Товар не знайдено'
  - ⚠ резерви вантажаться з .catch у fallback-обʼєкт — падіння резервів мовчазне
- [ ] **Оригінальні номери (inline-форма в табі)** _(inline)_ — Таб 'Оригінальні номери' у розгорнутому товарі: Додати/Редагувати/Зробити основним/Видалити
  - Поля: Код* (text, непорожній — кнопка Зберегти disabled); Основний (checkbox)
  - Запит: `POST /originalnumbers/new?isMain&productNetId body {MainNumber,Number} — створення`
  - Запит: `POST /originalnumbers/update?isMain&productNetId body OriginalNumber — редагування/зробити основним`
  - Запит: `DELETE /originalnumbers/delete?netId={originalNumberNetId}&productNetId — видалення`
  - Валідація: canSave=непорожній код; видалення основного заблоковане (disabled)
  - Успіх: зелений notification ('додано'/'оновлено'/'видалено'), список оновлюється з відповіді
  - Помилка: inline Alert; кнопки з loading=isSaving
  - ⚠ немає клієнтської перевірки дублікатів номера
  - ⚠ немає confirm перед видаленням
- [ ] **Повʼязані товари: видалення аналога/комплектуючої** _(action-modal)_ — Кнопка видалення в табі 'Аналоги'/'Комплектуючі'
  - Поля: removeIndirectAnalogues (прапорець для аналогів)
  - Запит: `POST /products/remove/analogues?analogueNetId&baseProductNetId&removeIndirectAnalogues (порожнє body)`
  - Запит: `POST /products/remove/component?baseProductNetId&componentNetId&isProductSet (порожнє body)`
  - Валідація: немає
  - Успіх: зелений notification 'Повʼязаний товар видалено', перезавантаження товару
  - Помилка: inline Alert
  - ⚠ без confirm; подвійний клік частково захищений removingNetUid
- [ ] **Імпорт товарів з файлу (ProductFileUploadModal)** _(import)_ — Меню 'Завантаження' → 'Товари' (permission PRODUCT_UPLOAD_DOCUMENT)
  - Поля: Операція (select mode); Файл* (FileInput, без accept-обмеження); Колонки: vendorCode* та ін. NumberInput (min 0); Рядки start/end; Ціни: рядки {тип ціни*, колонка*}; Джерело цін Fenix/AMG* (якщо є ціни)
  - Запит: `GET /pricings/all — довідник типів цін при відкритті`
  - Запит: `POST /products/upload/file — multipart {file, configuration JSON}`
  - Валідація: дублікати типів цін; джерело цін обовʼязкове при цінах; файл і обовʼязкові колонки (canSubmit); pricingId+columnNumber>0 для кожного рядка цін
  - Успіх: зелений notification 'Файл товарів завантажено', модалка закривається, refetch пошуку
  - Помилка: inline Alert (validation і серверні); кнопка loading=isUploading
  - ⚠ немає обмеження типу файлу (accept)
  - ⚠ колонки NumberInput required лише візуально — реальна перевірка тільки vendorCode через canSubmit; перевірити 500 від сервера на кривому Excel
- [ ] **Імпорт аналогів/комплектуючих/OEM (ProductUploadDocumentModal)** _(import)_ — Меню 'Завантаження' → Аналоги / Комплектуючі / Оригінальні номери
  - Поля: Файл* (required); Артикул товару* (text); Колонка-джерело (article); З / По (NumberInput); Кількість (тільки components); Очистити перед завантаженням (тільки OEM, checkbox)
  - Запит: `POST /products/upload/analogues/file | /products/upload/components/file | /products/upload/oems/file — multipart {productUploadDocument JSON, file}`
  - Валідація: canSubmit = file && vendorCode.trim(); Ctrl/Cmd+Enter сабмітить
  - Успіх: зелений notification 'Файл завантажено', закриття, refetch
  - Помилка: inline Alert; закриття заблоковане під час аплоаду
  - ⚠ діапазон З/По не валідується (from>to пропускається на сервер)
  - ⚠ 'Очистити перед завантаженням' — деструктивна опція без confirm
- [ ] **Завантаження місць зберігання (ProductPlacementStorageUploadModal)** _(import)_ — Меню 'Завантаження' → 'Місце зберігання'
  - Поля: Склад* (Select, з /storages/all/nondefective); Файл* (.xls/.xlsx/.csv); Початковий/Кінцевий рядок, колонки коду/кількості/місця (NumberInput)
  - Запит: `GET /storages/all/nondefective — довідник складів`
  - Запит: `POST /products/placements/storage/upload/placement/file — multipart {file, storageId, parseConfiguration}`
  - Запит: `POST /products/placements/storage/upload/placement/return — body {productPlacementStorages, storageId} для виправлених рядків`
  - Валідація: canUpload = файл + склад; виправлення: інлайн-редагування Місце/Кількість у таблиці 'Не пройшли позиції'
  - Успіх: зелений 'Розміщення завантажено' або жовтий 'Деякі позиції потребують виправлення' + таблиця корекції; лічильник невиправлених рядків висить бейджем у меню
  - Помилка: inline Alert; loading на кнопках
  - ⚠ стан корекції живе поза модалкою (correctionState) — після закриття/відкриття рядки лишаються; перевірити узгодженість зі складом
  - ⚠ Qty у корекції Number(value)||0 — некоректний ввід стає 0
- [ ] **Редагування товару (drawer 'Редагувати')** _(edit)_ — Іконка 'Редагувати' у діях товару (permission PRODUCT_EDIT)
  - Поля: Top (max 3 симв.); Розмір; Обʼєм; Вага (NumberInput min 0); Норма пакування; Пакування; Синоніми UA; Опис/Опис UA/Нотатки/Нотатки UA (textarea); Нульовий продаж, Для продажу (switch)
  - Запит: `POST /products/update?descriptionOnly=false — body: цілий обʼєкт product з накладеними полями форми (колекції вирізаються)`
  - Валідація: жодної (усі поля опційні)
  - Успіх: зелений notification 'Товар збережено', оновлення картки
  - Помилка: inline Alert над формою; кнопка loading=isSaving
  - ⚠ надсилається весь product — конкурентне редагування перетирає чужі зміни (last-write-wins)
  - ⚠ немає dirty-перевірки: можна зберігати без змін
- [ ] **Зображення товару (drawer 'Зображення')** _(edit)_ — Іконка 'Зображення'; додавання файлів (permission PRODUCT_IMAGE_ADD), головне/видалення (PRODUCT_IMAGE_DELETE)
  - Поля: Додати зображення (FileInput multiple accept=image/*); Зробити головним / Видалити (позначки на картках)
  - Запит: `POST /products/update/upload — multipart {images[], entity JSON}`
  - Валідація: кнопка Зберегти disabled без змін (hasChanges)
  - Успіх: зелений 'Зображення збережено', превʼю оновлюються
  - Помилка: inline Alert
  - ⚠ видалення — мітка Deleted до збереження, без confirm; перевірити скасування (Скасувати повертає оригінал)
- [ ] **Специфікація товару (drawer 'Специфікація')** _(edit)_ — Іконка 'Специфікація' (зміна — permission PRODUCT_SPECIFICATION_CHANGE)
  - Поля: Код специфікації* (text); Митна вартість / Мито / ПДВ (NumberInput decimal 2)
  - Запит: `POST /products/specification/new — body: product + повний масив ProductSpecifications з новим записом`
  - Валідація: лише непорожній код (setError 'Вкажіть код специфікації')
  - Успіх: зелений 'Специфікацію збережено', драфт очищується, історія оновлюється
  - Помилка: inline Alert
  - ⚠ числові поля без меж/required — можна зберегти специфікацію без ставок
  - ⚠ повторний код не блокується (dedupe лише при відображенні)
- [ ] **Правила списання (drawer 'Правила списання')** _(edit)_ — Іконка 'Правила списання' (permission PRODUCT_WRITE_OFF)
  - Поля: Scope: товар/група (група — Select з GET /products/groups/all/product); RuleType (select, число); RuleLocale (select)
  - Запит: `GET /products/writeoff/rules/all/product?netId | /products/writeoff/rules/all/productgroup?netId — список`
  - Запит: `POST /products/writeoff/rules/process — body {Product|ProductGroup, RuleType, RuleLocale}`
  - Запит: `DELETE /products/writeoff/rules/delete?netId={ruleNetUid}`
  - Валідація: для scope=group обовʼязкова вибрана група
  - Успіх: зелений 'Правило списання збережено/видалено', upsert у таблиці
  - Помилка: inline Alert
  - ⚠ видалення без confirm
  - ⚠ якщо сервер повертає null — робиться тихий reloadRules без повідомлення про аномалію
- [ ] **Місця зберігання (ProductPlacementEditor)** _(inline)_ — Редагування розміщень у блоці залишків по складу
  - Поля: Рядки: StorageNumber/RowNumber/CellNumber (text), Qty (number)
  - Запит: `POST /products/placements/storage/update — body: масив placements`
  - Валідація: сума Qty по місцях має дорівнювати залишку складу (епсілон 1e-5), інакше setError і блок сабміту
  - Успіх: зелений 'Місця зберігання збережено', закриття редактора
  - Помилка: inline Alert
  - ⚠ порожні номери місця не валідуються — можна зберегти рядок без адреси
- [ ] **Рух товару + експорт (таб/drawer 'Рух товару')** _(filter)_ — Таб 'Рух' (permission PRODUCT_MOVEMENT): фільтри дат і типів руху; кнопка 'Експорт'
  - Поля: from/to (date); types (мультивибір типів руху); movementType
  - Запит: `GET /consignments/info/movement/filtered?from&to&productNetId&movementType&types`
  - Запит: `GET /consignments/info/income/filtered, GET /consignments/info/outcome/filtered — підтаби прихід/вихід`
  - Запит: `GET /consignments/info/movement/document/export | /consignments/info/income/document/export | /consignments/info/outcome/document/export — експорт → модалка XLSX/PDF`
  - Запит: `GET /consignments/remaining/all/product?netId — таб 'Залишки по партіям'`
  - Запит: `GET /products/placements/history/all/filtered — 'Історія місця зберігання'`
  - Запит: `GET /auditing/get/limited?netId&fieldName — таб аудиту`
  - Запит: `GET /recommendations/forecast — панель аналітики`
  - Валідація: експорт disabled без productNetUid
  - Успіх: таблиця рухів; модалка завантаження документа
  - Помилка: inline Alert у панелі
  - ⚠ дефолтний діапазон 30 днів — легко забути звузити на великих товарах (повільні відповіді)

### `/products/:netId` — Deep-link на товар


### `/products/consignments/availabilities` — Доступність партій

- [ ] **Фільтри доступності** _(filter)_ — Селект складу, дати від/до, пошук за артикулом (дебаунс), пагінація
  - Поля: Склад* (Select, авто-перший); from/to (date, перевірка from<=to); vendorCode (text)
  - Запит: `GET /storages/get/all — довідник складів`
  - Запит: `GET /consignments/info/availability/filtered?from&limit&offset&storageNetId&to&vendorCode — при кожній зміні`
  - Валідація: filterError при некоректному діапазоні дат — блокує завантаження й експорт
  - Успіх: таблиця + Total у пагінаторі
  - Помилка: inline Alert
  - ⚠ без вибраного складу дані не вантажаться — перевірити стан, коли складів 0
- [ ] **Експорт доступності** _(action-modal)_ — Кнопка 'Друк/Експорт'
  - Запит: `GET /consignments/info/availability/filtered/export?from&storageNetId&to&vendorCode`
  - Валідація: disabled без складу або з filterError
  - Успіх: PDF відкривається у попередньо відкритому вікні, або модалка з посиланнями
  - Помилка: inline Alert; pending-вікно закривається
  - ⚠ попап-блокер: pending window може бути заблоковане

### `/products/income/documents` — Документи приходу товару

- [ ] **Фільтри документів приходу** _(filter)_ — Дати від/до + пошук (value), пагінація; значення персистяться в localStorage
  - Поля: from/to (date, from<=to); value (text)
  - Запит: `GET /products/incomes/all?from&limit&offset&to&value`
  - Валідація: filterError на діапазон дат
  - Успіх: таблиця документів + Total
  - Помилка: inline Alert
  - ⚠ персистенція фільтрів у localStorage: після довгої перерви користувач бачить 'порожньо' через старі дати
- [ ] **Опції документа (ProductIncomeOptionsModal)** _(action-modal)_ — Клік по рядку документа
  - Запит: `GET /products/incomes/get?netId — 'Деталі документа' (drawer)`
  - Запит: `GET /consignments/remaining/all/income?netId — 'Залишки по партіям'`
  - Запит: `(навігація 'Відкрити джерело' — без запиту)`
  - Валідація: 'Залишки' disabled без NetUid
  - Успіх: drawer з деталями/залишками
  - Помилка: помилка в drawer
- [ ] **Друк документа приходу** _(action-modal)_ — Кнопка експорту в рядку таблиці або в drawer
  - Запит: `GET /products/incomes/document/export?netId`
  - Валідація: loading per-row (exportingNetId)
  - Успіх: модалка завантаження XLSX/PDF
  - Помилка: setError / повідомлення в drawer; захист від гонок через exportRequestRef
- [ ] **Історія руху/місця зберігання товару (shared drawers)** _(action-modal)_ — Кнопки у рядках позицій документа
  - Поля: from/to, типи руху
  - Запит: `GET /consignments/info/movement/filtered | /income/filtered | /outcome/filtered`
  - Запит: `GET /products/placements/history/all/filtered`
  - Запит: `GET /consignments/info/movement/document/export (+income/outcome) — друк`
  - Валідація: —
  - Успіх: drawer з таблицею
  - Помилка: inline Alert у drawer

### `/products/income/ukraine` — Прихід (Україна)


### `/products/placements` — Розміщення товарів

- [ ] **Фільтри розміщень** _(filter)_ — Мультиселект складів, дата 'до', пошук, пагінація
  - Поля: storages (multi, з /storages/all/nondefective); dateTo (date, обовʼязкова); value (text)
  - Запит: `GET /storages/all/nondefective`
  - Запит: `GET /products/placements/storage/all/filtered?limit&offset&storageId&to&value`
  - Валідація: filterError якщо dateTo порожня або складів не вибрано
  - Успіх: таблиця + Total
  - Помилка: inline Alert
- [ ] **Експорт розміщень** _(action-modal)_ — Кнопка 'Експорт'
  - Запит: `GET /products/placements/storage/document/create/export`
  - Валідація: —
  - Успіх: модалка XLSX/PDF
  - Помилка: inline Alert
  - ⚠ експорт ігнорує поточні фільтри (без параметрів) — перевірити очікування користувача
- [ ] **Імпорт розміщень (ProductPlacementImportModal)** _(import)_ — Кнопка 'Імпорт' (disabled якщо складів немає)
  - Поля: Файл*; Склад*; StartRow/EndRow; ColumnVendorCode/ColumnQty/ColumnPlacement
  - Запит: `POST /products/placements/storage/upload/placement/file — multipart {file, storageId, parseConfiguration}`
  - Валідація: файл обовʼязковий; storageId число; StartRow<=EndRow
  - Успіх: зелений 'Файл розміщень завантажено' + reload; якщо є непройдені — відкривається модалка 'Повернені позиції'
  - Помилка: inline Alert у модалці; loading=isUploading
- [ ] **Повернені позиції (ReturnedProductsModal, inline-редагування)** _(inline)_ — Автовідкриття після імпорту з помилками або кнопка на тулбарі
  - Поля: Placement (text, per-row); Qty (number, per-row; нечислове → 0)
  - Запит: `POST /products/placements/storage/upload/placement/return — body {productPlacementStorages, storageId}`
  - Запит: `POST /products/placements/storage/document/create/import — body rows (експорт непройдених)`
  - Валідація: submit disabled якщо рядків 0
  - Успіх: зелений 'Повернені позиції оновлено' + reload; якщо знову є непройдені — рядки замінюються новими
  - Помилка: inline Alert
  - ⚠ storageId береться з першого рядка (returnedRows[0]?.StorageId) — рядки з різних складів підуть з одним storageId
  - ⚠ Qty=0 проходить на сервер без клієнтської заборони
- [ ] **Картка товару (ProductCardModal)** _(action-modal)_ — Клік по артикулу/назві в рядку
  - Запит: `GET /products/get?netId`
  - Валідація: —
  - Успіх: модалка з фото/цінами
  - Помилка: помилка/порожній стан у модалці

### `/products/storages` — Склади (наявність по складу)

- [ ] **Фільтри наявності по складу** _(filter)_ — Селект складу (обовʼязковий), дати, пошук, пагінація; чекбокси вибору рядків для групових дій
  - Поля: Склад*; from/to (date, from<=to); value (text)
  - Запит: `GET /storages/get/all`
  - Запит: `GET /storages/all/available/filtered?from&limit&netId={storageNetId}&offset&to&value`
  - Валідація: filterError по датах; без складу не вантажиться
  - Успіх: таблиця залишків, чекбокси доступні
  - Помилка: inline Alert
- [ ] **Експорт складу** _(action-modal)_ — Кнопка 'Експорт' (disabled без складу/при filterError)
  - Запит: `GET /storages/document/export?from&netId&to`
  - Валідація: захист від гонок exportRequestRef + scopeKey
  - Успіх: модалка XLSX/PDF
  - Помилка: inline Alert
- [ ] **Дія зі складською позицією: Переміщення / Списання / Повернення постачальнику (ProductStorageActionModal, drawer)** _(action-modal)_ — Кнопка дії в рядку (single) або 'Дії' після вибору чекбоксами (group, через Preview drawer)
  - Поля: Режим (transfer/writeoff/return); Дата операції* (datetime); Кількість* (single: >0 і <= доступного; group: per-row у превʼю); Склад призначення* (transfer); Місце: storageNumber/rowNumber/cellNumber (transfer single); Прихід для повернення* (return, вибір партії з ConsignmentItemId); Коментар; IsManagement (checkbox, тільки адмін)
  - Запит: `POST /products/transfers/new?storageNumber&rowNumber&cellNumber — body productTransfer (transfer)`
  - Запит: `POST /orders/depreciated/new — body {Comment,DepreciatedOrderItems,FromDate,IsManagement,Organization,Storage} (writeoff)`
  - Запит: `POST /supplies/returns/new — body {ClientAgreement,Supplier,SupplyReturnItems[{ConsignmentItemId,Product,Qty}],...} (return)`
  - Запит: `GET /consignments/remaining/get/available?productNetId&storageNetId — партії для return`
  - Валідація: validateAction: склад визначено; дата задана і коректна; qty>0 та <= доступного (для return — min(залишок, RemainingQty партії)); transfer: склад призначення зі списку; return: вибрана партія з ConsignmentItemId; permission-гейт (canOpenAction)
  - Успіх: зелений notification ('Переміщення створено'/'Списання створено'/'Повернення створено'), закриття, reload списку
  - Помилка: inline Alert у drawer; кнопки disabled=isSubmitting
  - ⚠ для transfer вибір Organization різниться single/group (selectedToStorage.Organization vs fromStorage.Organization) — перевірити міжорганізаційні переміщення
  - ⚠ групове повернення (return) недоступне лише частково через опції режимів — перевірити, що group+return не пропускає без партії
  - ⚠ writeoff — незворотна операція без confirm-кроку

### `/products/storages/incomes(/:tab)` — Залишки (партії / товари)

- [ ] **Фільтри залишків (спільні для табів batches/products)** _(filter)_ — Таби 'Партії'/'Товари' (маплені на :tab у URL), селект складу ('Всі' дозволено лише для партій), автокомпліт постачальника, дати, пошук товару
  - Поля: Склад (для products — обовʼязковий); Постачальник (autocomplete, пошук з непорожнім значенням); from/to (date); searchValue (products tab)
  - Запит: `GET /storages/get/all`
  - Запит: `GET /clients/suppliers/all/filtered?filterSql=RegionCode.Value/Client.FullName&limit&offset&value — підказки постачальника`
  - Запит: `GET /consignments/remaining/grouped/storage/filtered?from&includeItems&limit&offset&storageNetId&supplierNetId&to — таб партій`
  - Запит: `GET /consignments/remaining/all/storage/filtered?from&limit&offset&searchValue&storageNetId&supplierNetId&to — таб товарів`
  - Валідація: filterError по датах; products без складу → повідомлення 'Оберіть склад для перегляду товарів' і дані не вантажаться
  - Успіх: таблиці з футером підсумків (кількість/суми, у т.ч. управлінські)
  - Помилка: inline Alert над таблицею
  - ⚠ перемикання табу міняє URL — перевірити, що фільтри переживають перемикання
  - ⚠ пошук постачальника без AbortController-помилок: помилка ковтається в setSupplierResourceError?
- [ ] **Деталі партії (drawer BatchDetails)** _(action-modal)_ — Клік по рядку партії
  - Запит: `GET /consignments/remaining/grouped/storage/filtered (includeItems) — позиції партії`
  - Валідація: —
  - Успіх: drawer з таблицею позицій
  - Помилка: помилка в drawer
- [ ] **Рух по партії (drawer ProductRemainMovementsPanel)** _(action-modal)_ — Кнопка 'Рух' у рядку таба 'Товари'
  - Поля: from/to (date)
  - Запит: `GET /consignments/info/movement/specific?consignmentItemNetId&from&to`
  - Валідація: —
  - Успіх: таблиця руху
  - Помилка: inline Alert
- [ ] **Експорт залишків** _(action-modal)_ — Кнопка 'Експорт' (по активному табу)
  - Запит: `GET /consignments/remaining/grouped/storage/document/export?from&storageNetId&supplierNetId&to — партії`
  - Запит: `GET /consignments/remaining/document/export?from&searchValue&storageNetId&supplierNetId&to — товари`
  - Валідація: disabled при filterError; захист від гонок exportScopeKey
  - Успіх: модалка XLSX/PDF
  - Помилка: inline Alert

### `/products/transfers` — Переміщення товарів

- [ ] **Фільтри переміщень** _(filter)_ — Дати від/до, Застосувати/Скинути, пагінація
  - Поля: from/to (date, from<=to)
  - Запит: `GET /products/transfers/all/filtered?from&limit&offset&to`
  - Валідація: filterError по датах
  - Успіх: таблиця + Total
  - Помилка: inline Alert
- [ ] **Деталі переміщення (drawer)** _(action-modal)_ — Клік по рядку
  - Запит: `GET /products/transfers/get?netId`
  - Валідація: гонки через detailRequestRef
  - Успіх: drawer з позиціями
  - Помилка: помилка в drawer
- [ ] **Друк переміщення** _(action-modal)_ — Кнопка друку в рядку/drawer
  - Запит: `GET /products/transfers/document/export?netId`
  - Валідація: —
  - Успіх: модалка XLSX/PDF
  - Помилка: downloadError у модалці
- [ ] **Створення переміщення з файлу** _(create)_ — Кнопка 'Нове переміщення' → модалка (form onSubmit)
  - Поля: Зі складу* (Select); На склад* (Select, ≠ зі складу); Дата* (fromDate); Файл* (Excel); StartRow/EndRow, колонки VendorCode/Qty; Коментар; IsManagement (адмін)
  - Запит: `GET /storages/get/all — довідник`
  - Запит: `POST /products/transfers/add/file — multipart {parseConfiguration, productTransfer, file}`
  - Валідація: validateCreateForm: обидва склади вибрані; склади не збігаються; без IsManagement — однакова організація складів; дата обовʼязкова; файл обовʼязковий
  - Успіх: закриття модалки, reload; notification зелений 'Переміщення створено' або жовтий 'створено з попередженнями' + окрема модалка exceptionMessages (рядки, що не пройшли)
  - Помилка: inline Alert у модалці; закриття заблоковане при isCreating
  - ⚠ колонки/діапазон рядків не валідуються (можна відправити 0)
  - ⚠ попередження сервера показуються лише один раз — після закриття модалки повторно не подивитись

### `/products/capitalization` — Оприбуткування товарів

- [ ] **Фільтри оприбуткувань** _(filter)_ — Дати від/до, пагінація
  - Поля: from/to (date, from<=to)
  - Запит: `GET /products/capitalizations/all/filtered?from&limit&offset&to`
  - Валідація: filterError по датах
  - Успіх: таблиця + Total
  - Помилка: inline Alert
- [ ] **Деталі/друк оприбуткування** _(action-modal)_ — Клік по рядку → drawer; кнопка друку в рядку/drawer
  - Запит: `GET /products/capitalizations/get?netId`
  - Запит: `GET /products/capitalizations/document/export?netId`
  - Валідація: друк disabled без NetUid / при активному exportingNetId
  - Успіх: drawer з позиціями і підсумками; модалка XLSX/PDF
  - Помилка: inline Alert
- [ ] **Нове оприбуткування (NewProductCapitalizationPanel, drawer)** _(create)_ — Кнопка 'Нове оприбуткування'
  - Поля: Організація* (Select); Склад* (Select, залежить від організації); Дата* (datetime-local); Коментар; Позиції: Артикул* (autocomplete по товарах), Кількість* (>0, ціле), Ціна за одиницю* (>0), Вага; редагування/видалення рядків
  - Запит: `GET /organizations/all — організації`
  - Запит: `GET /storages/get/all/filtered?organizationNetId&skipDefective=false — склади організації`
  - Запит: `GET /products/search/vendorcode?limit&offset&value — підказки артикулів (дебаунс)`
  - Запит: `POST /products/capitalizations/new — body {Comment,FromDate,Organization,Storage,ProductCapitalizationItems}`
  - Валідація: жовті notifications: 'Додайте хоча б один товар', Qty>0, ціна>0 (де required), рядки без активного товару, склад/організація/дата; захист від подвійного сабміту (isSubmitting/requestId); при null-відповіді сервера — штучна помилка 'Сервер не повернув створене оприбуткування'
  - Успіх: зелений 'Оприбуткування створено', drawer закривається, список reload
  - Помилка: inline Alert (серверна помилка); валідація — жовті notifications
  - ⚠ пошук артикулів має порожній catch → список просто порожніє без повідомлення
  - ⚠ валідація ціни залежить від __priceRequired (рядки з Excel без цін можуть пройти з ціною 0 — перевірити очікування бухгалтерії)
- [ ] **Імпорт позицій з Excel (ProductCapitalizationUploadModal)** _(import)_ — Кнопка 'Імпорт з Excel' у панелі створення
  - Поля: Файли* (multiple .xls/.xlsx/.csv); Колонки: Артикул*, Кількість*, Ціна, Вага (NumberInput); StartRow*/EndRow*; pricePerItem/weightPerItem (checkbox)
  - Запит: `POST /products/capitalizations/get/items/file — multipart {file, configuration} (по одному запиту на файл, Promise.all)`
  - Валідація: файли+артикул+кількість+діапазон обовʼязкові; EndRow>=StartRow; колонки не повторюються
  - Успіх: розпізнані рядки додаються в таблицю позицій; при невідомих артикулах — модалка ProductCapitalizationMissingItemsModal зі списком
  - Помилка: inline Alert (у т.ч. спецпомилка колонки артикула); модалку не можна закрити під час парсингу
  - ⚠ часткові збої Promise.all: якщо один із файлів падає — весь парсинг падає, вже розпізнані файли губляться

### `/products/assortment` — Асортимент (Product Intelligence)

- [ ] **Фільтри дашборда** _(filter)_ — Селекти asOfDate/band/ABC/XYZ/lifecycle/sort/регіон у шапці
  - Поля: asOfDate (date); band/abc/xyz/lifecycle/sort (select); regionId + regionWindowDays
  - Запит: `GET /products/intelligence/assortment/overview?asOfDate`
  - Запит: `GET /products/intelligence/assortment/health?asOfDate&band&abc&xyz&lifecycle&sort&limit=100&stockedOnly&regionId&regionWindowDays`
  - Запит: `GET /products/intelligence/assortment/regions, /assortment/stock, /assortment/margin, /assortment/returns`
  - Валідація: немає
  - Успіх: KPI, банди, таблиця здоровʼя
  - Помилка: Promise.allSettled — часткові помилки конкатенуються в один Alert ('msg · msg')
  - ⚠ часткова відмова: таблиці можуть бути порожні при живих KPI — QA перевіряє повідомлення
- [ ] **Деталі товару (drawer аналітики)** _(action-modal)_ — Клік по товару в таблиці
  - Запит: `GET /products/intelligence/product/{productId}?asOfDate`
  - Запит: `GET /products/intelligence/product/{productId}/analytics?months=12`
  - Запит: `GET /products/intelligence/product/{productId}/regions`
  - Запит: `GET /products/intelligence/product/{productId}/substitutes`
  - Валідація: —
  - Успіх: drawer з графіками
  - Помилка: помилка в drawer

### `/products/history` — Історія продажів товарів

- [ ] **Фільтри історії** _(filter)_ — Мультиселект складів, дати, пошук, пагінація
  - Поля: storageIds (multi); from/to (date); value (text)
  - Запит: `GET /storages/get/all`
  - Запит: `GET /history/order/item/get?from&limit&offset&storageIds={comma}&to&value`
  - Валідація: filterError по датах
  - Успіх: таблиця + Total
  - Помилка: inline Alert
- [ ] **Експорт історії** _(action-modal)_ — Кнопка 'Експорт'
  - Запит: `GET /history/order/item/document/create/export?from&limit&offset&storageIds&to&value`
  - Валідація: disabled при filterError
  - Успіх: PDF у новому вікні або модалка завантаження
  - Помилка: inline Alert
  - ⚠ в export передаються limit/offset поточної сторінки — перевірити, чи експортується вся вибірка чи лише сторінка

### `/product-groups` — Групи товарів

- [ ] **Пошук груп** _(filter)_ — Поле пошуку (дебаунс 300мс)
  - Поля: value (text)
  - Запит: `GET /products/groups/filtered/get?value`
  - Валідація: немає
  - Успіх: таблиця груп (TotalQty/TotalFilteredQty)
  - Помилка: inline Alert
- [ ] **Створення групи (модалка)** _(create)_ — Кнопка 'Нова група' (permission PRODUCT_GROUPS_ADD)
  - Поля: Назва* (max 100); Повна назва (max 200); Батьківська група (searchable Select); Опис (max 1000); Активна (switch, дефолт on)
  - Запит: `GET /products/groups/root/groups/get — батьківські групи при відкритті`
  - Запит: `POST /products/groups/new — body ProductGroup (+RootProductGroups)`
  - Валідація: validateProductGroup: лише непорожня Назва
  - Успіх: зелений 'Групу товарів створено'; navigate на /product-groups/{NetUid} (sheet), інакше reload
  - Помилка: inline Alert у модалці
  - ⚠ дублікати назв не перевіряються
  - ⚠ 422/409 від сервера показується лише текстом ApiError

### `/product-groups/tree` — Групи товарів (дерево)

- [ ] **Пошук по дереву** _(filter)_ — Поле пошуку над TreeView
  - Поля: value (text)
  - Запит: `GET /products/groups/filtered/get?value — список для дерева`
  - Запит: `GET /products/groups/with/root/get?netId — деталі вибраного вузла`
  - Валідація: немає
  - Успіх: дерево + панель деталей
  - Помилка: inline Alert
  - ⚠ read-only сторінка — мутацій немає

### `/product-groups/:id` — Група товарів (деталі)

- [ ] **Редагування групи** _(edit)_ — Sheet відкривається зі списку/дерева; форма з кнопками Зберегти/Скинути
  - Поля: Назва* (max 100); Повна назва; Батьківська група (Select); Опис; Активна (switch)
  - Запит: `GET /products/groups/with/root/get?netId + GET /products/groups/root/groups/get — завантаження`
  - Запит: `POST /products/groups/with/content/update — body ProductGroup`
  - Валідація: validateProductGroup (Назва обовʼязкова); Зберегти disabled якщо !isEdited або isSaving
  - Успіх: зелений notification 'Групу товарів збережено'
  - Помилка: inline Alert
  - ⚠ деактивація групи (IsActive=false) без попередження про наслідки для товарів
  - ⚠ видалення групи в UI відсутнє (API DELETE /products/groups/delete не використовується)
- [ ] **Панель товарів групи** _(filter)_ — Таб/панель 'Товари' з пошуком і пагінацією
  - Поля: value (text)
  - Запит: `GET /products/groups/filtered/products/get?limit&netId&offset&value`
  - Валідація: —
  - Успіх: таблиця товарів
  - Помилка: inline Alert
- [ ] **Панель підгруп** _(filter)_ — Панель 'Підгрупи' з пошуком і пагінацією
  - Поля: value (text)
  - Запит: `GET /products/groups/filtered/sub/groups/get?limit&netId&offset&value`
  - Валідація: —
  - Успіх: таблиця підгруп
  - Помилка: inline Alert

### `/pricing` — Рекомендація ціни (AI)

- [ ] **Вибір товару/клієнта/угоди** _(filter)_ — Три searchable Select (мін. 2 символи, дебаунс 400мс); підтримка deep-link ?productNetId&clientAgreementNetId
  - Поля: Товар* (search); Клієнт (search); Угода клієнта* (select, авто-перша після вибору клієнта)
  - Запит: `GET /products/search/vendorcode?limit=20&offset=0&value — пошук товару`
  - Запит: `GET /clients/all/filtered?... — пошук клієнта`
  - Запит: `GET /agreements/client/all?netId={clientNetId} — угоди`
  - Валідація: рекомендація рахується лише коли задані товар+угода (інакше hint-текст)
  - Успіх: панель PriceHintPanel з рекомендацією
  - Помилка: ПОМИЛКИ ПОШУКІВ КОВТАЮТЬСЯ: catch → порожній список без повідомлення (виглядає як 'Нічого не знайдено')
  - ⚠ проковтнуті помилки lookup-запитів (мережа/500 нерозрізнимі від 'не знайдено')
  - ⚠ при виборі клієнта угода автопідставляється першою — можлива неочікувана угода
- [ ] **Отримання рекомендації ціни** _(filter)_ — Автоматично при заданих product+agreement
  - Запит: `GET /pricing/recommend?productNetId&clientAgreementNetId&culture=uk&withVat=true`
  - Валідація: —
  - Успіх: картка рекомендації (ціна/минулі продажі)
  - Помилка: inline повідомлення 'Рекомендація недоступна' + текст помилки
- [ ] **Ціни конкурентів (веб-пошук)** _(filter)_ — Поле запиту + кнопки Google Shopping/Prom/Rozetka/Google
  - Поля: query (text, авто з номера/артикула/назви)
  - Запит: `(немає запитів на бекенд — зовнішні лінки в нових вкладках)`
  - Валідація: кнопки disabled при порожньому запиті
  - Успіх: відкриття зовнішнього пошуку
  - Помилка: —

## Модуль СКЛАД — 19 сторінок, 82 форм

> Усі шляхи apiRequest реально формуються як /api/v1/{lang}{path} (lang за замовчуванням uk, з env VITE_API_LANGUAGE). Нижче в requests шляхи вказані без префікса /api/v1/uk для стислості.
> GET-запити йдуть через дедуплікацію in-flight у shared/api/apiClient; помилки нормалізуються в ApiError з Message із envelope.
> Ключові файли: src/features/warehouse-ukraine/*, src/features/product-delivery-protocols/*, src/features/supply-ukraine-orders/*, src/features/supply-ukraine-payment-protocols/*, src/features/depreciated-orders/*, src/features/supply-returns/*, src/features/transporters/*, src/features/basket-supply-ukraine-order/*, src/features/product-income-documents/pages/SupplyOrderProductPlacementPage.tsx
> Наскрізний патерн: майже ніде немає mantine useForm — валідація ручна (setValidationError/notifications), помилки показуються або Alert у формі, або notifications.show({color:'red'}).
> Табличні сторінки використовують keep-alive табів (WarehouseUkrainePage): стан фільтрівживе між перемиканнями табів, але губиться при hard reload (крім OrdersTab, який кешує фільтр у module-scoped змінній).

### `/warehouse/ukraine` — Склад Україна (таби: Накладні / Відвантаження / Замовлення на Україну / Протокол актів редагування / Реєстр накладних / Звірка)

- [ ] **Фільтр накладних (таб «Накладні»)** _(filter)_ — Поля «Пошук по товару», «Від», «До» у filter-bar таба
  - Поля: Пошук по товару (text, debounce 350мс); Від (date, дефолт -7 днів); До (date, дефолт сьогодні)
  - Запит: `GET /sales/all/filtered?from&to&value&limit&offset — при зміні фільтрів/сторінки`
  - Валідація: якщо from/to порожні або from>to — жовтий Alert, запит не йде, таблиця порожніє
  - Успіх: таблиця оновлюється, пагінація через Paginator
  - Помилка: червоний Alert над таблицею з текстом помилки
  - ⚠ реал-тайм події saleAdded/saleUpdated дебаунсять reload на 800мс — можлива гонка з ручним редагуванням
- [ ] **Друк накладної / акта редагування (таб «Накладні»)** _(action-modal)_ — Іконки Printer (PDF пакет) і FileDown (PDF акт редагування) в колонці дій
  - Поля: немає — дія в 1 клік
  - Запит: `POST /sales/update — оптимістично ставить IsPrinted/IsPrintedActProtocolEdit перед друком (з операційним ID, persistent-mutation runner)`
  - Запит: `GET /sales/get/document?netId — PDF пакет`
  - Запит: `GET /sales/get/shifted/document?netId — акт редагування`
  - Валідація: друк тільки якщо sale.NetUid; повторний друк не переоновлює статус якщо IsPrinted і немає approved-правок
  - Успіх: DownloadDocumentModal з посиланнями Excel/PDF; статус друку в рядку оновлюється
  - Помилка: якщо POST /sales/update впав — рядок відкочується, повідомлення в error-банер таба; помилка документа — текст у модалці
  - ⚠ оптимістичне оновлення + reload: якщо update впав після відкриття модалки, документ все одно вантажиться
  - ⚠ requestRef захищає від гонки при закритті модалки
- [ ] **Нова накладна (NewSaleWizard) і дровер деталей продажу** _(create)_ — Кнопка «+» (потрібен пермішн SALES_UKRAINE_EDIT); клік по перевізнику відкриває SaleDetailsDrawer
  - Поля: крос-модульні форми з features/sales-ukraine — тестуються в модулі Продажі
  - Запит: `POST /sales/update (через sales-ukraine) — при збереженні перевізника; onSaved → reload списку`
  - Успіх: дровер закривається, список перезавантажується
  - Помилка: усередині компонентів sales-ukraine
  - ⚠ дублювання поведінки з /sales — регрес в одному місці може не відтворюватись в іншому
- [ ] **Створення відвантаження (авто) — таб «Відвантаження»** _(edit)_ — Селекти «Тип перевізника» → «Перевізник», date range; список формується автоматично
  - Поля: Тип перевізника* (select, GET /transporters/types/all, перший автообирається); Перевізник* (select, GET /transporters/all/type?netId); Від/До (date, обовʼязкові, from<=to); К-сть місць (inline number по рядку)
  - Запит: `GET /sales/shipments/update/filtered/auto?netId&from&to — формує/оновлює список`
  - Запит: `POST /sales/shipments/update?from&to — автозбереження при зміні QtyPlaces (одразу після зміни клітинки) і кнопкою збереження`
  - Запит: `POST /sales/shipments/update (IsSent:true) — «Провести» після confirm-модалки «Чи дійсно ви бажаєте провести?»`
  - Запит: `GET /sales/shipments/document/create/export?netId&from&to — друк`
  - Валідація: К-сть місць: NaN/<0 → error «Кількість місць не може бути від’ємною», запит не йде
  - Успіх: список рефрешиться; після «Провести» — IsSent, редагування блокується; друк відкриває документ у новому вікні або DownloadDocumentModal
  - Помилка: setError → банер таба; кнопки з loading={isSaving}
  - ⚠ автозбереження на кожну зміну клітинки без дебаунса — швидкий ввід генерує серію POST /sales/shipments/update; можлива гонка збережень
  - ⚠ carryOut надсилає весь shipmentList — конфлікт з паралельним редагуванням іншого користувача
- [ ] **Перегляд/редагування існуючих відвантажень — таб «Відвантаження», режим «всі списки»** _(edit)_ — Фільтр (перевізник опц., від/до, пагінація) → клік по рядку відкриває відвантаження
  - Поля: К-сть місць (inline number по позиції); ручний підбір накладних: чекбокси + К-сть місць по кожній
  - Запит: `GET /sales/shipments/all/filtered?netId&from&to&limit&offset`
  - Запит: `GET /sales/shipments/get?netId — відкриття/перезавантаження після save`
  - Запит: `GET /sales/all/transporter/filtered?netId&from&to — ручний підбір накладних`
  - Запит: `POST /sales/shipments/update — «Зберегти» (без from/to вікна!)`
  - Запит: `GET /sales/shipments/document/export?netId — друк відвантаження`
  - Запит: `GET /sales/shipment/list/print/documents?netId — ТТН по накладній`
  - Валідація: QtyPlaces<0 блокується («Кількість місць не може бути від’ємною»); ручний підбір: «Виберіть накладні для додавання», дублікати пропускаються з жовтим notification
  - Успіх: green notification «Накладні додано до відвантаження»; після save — reload обраного відвантаження
  - Помилка: editError банер; закриття з незбереженими змінами — confirm «Закрити без збереження?»
  - ⚠ saveSelectedShipment викликає updateShipmentList БЕЗ query-вікна from/to (на відміну від авто-режиму) — сервер може реконсилювати/soft-delete айтеми поза видимим вікном
  - ⚠ IsSent-відвантаження read-only тільки на клієнті (canEditShipment)
- [ ] **Одержувач доставки (модалка)** _(action-modal)_ — Іконка редагування одержувача в рядку відвантаження
  - Поля: Повне ім'я (text); Мобільний телефон (text)
  - Запит: `POST /sales/update/recipient?netId — body recipient + операційний ID header`
  - Валідація: НЕМАЄ — можна зберегти порожні значення
  - Успіх: модалка закривається, рядок оновлюється локально
  - Помилка: error банер таба; кнопка loading
  - ⚠ відсутня валідація телефону/імені; якщо у накладної немає одержувача, редагування адреси блокується жовтим notification «Додайте одержувача»
- [ ] **Адреса доставки (модалка)** _(action-modal)_ — Іконка редагування адреси
  - Поля: Місто (text); Відділення (text); Адреса (text)
  - Запит: `POST /sales/update/recipient/address?netId`
  - Валідація: НЕМАЄ
  - Успіх: модалка закривається
  - Помилка: error банер таба
  - ⚠ без валідації; read-only якщо isRecipientAddressReadOnly
- [ ] **Зміна коментара (модалка)** _(action-modal)_ — Іконка коментаря в рядку
  - Поля: Коментар* (textarea)
  - Запит: `POST /sales/update/comment?netId — body {NetUid, Comment}`
  - Валідація: порожній trim → Alert «Поле - обов’язкове» (після спроби зберегти)
  - Успіх: модалка закривається, коментар у рядку оновлюється
  - Помилка: error банер таба
- [ ] **Фільтр «Замовлення на Україну» (таб)** _(filter)_ — date range + Select «Статус» (Не оприбутковані/Оприбутковані) — застосовується миттєво при зміні
  - Поля: Від/До (date); Статус (select placed true/false, дефолт «Не оприбутковані»)
  - Запит: `GET /supplies/ukraine/order/all/filtered?from&to&limit&offset&placed&nonPlaced`
  - Валідація: порожні/невалідні дати → жовтий Alert, дані очищуються
  - Успіх: клік по рядку → навігація на /warehouse/ukraine/orders/:netUid/placements (як sheet поверх списку)
  - Помилка: червоний Alert
  - ⚠ фільтр кешується в module-scoped змінній — переживає drill-down, губиться при reload (задокументована legacy-поведінка)
- [ ] **Протокол актів редагування — підтвердження акту/перевізника** _(action-modal)_ — Таб «Протокол актів редагування накладних», кнопка підтвердження в рядку (2 підтаби: акти і перевізники)
  - Поля: confirm-модалка з переглядом змін; для актів — SaleAuditDetail (GET історія по продажу)
  - Запит: `GET /protocol/act/invoice/get/edit/act/for/editing?from&to&limit&offset — список актів`
  - Запит: `GET /protocol/act/invoice/get/edit/transporters?... — список перевізників`
  - Запит: `GET /protocol/act/invoice/get/edit/act/for/editing/qty і /protocol/act/invoice/get/edit/transporters/qty — бейдж на табі`
  - Запит: `GET(без method) /protocol/act/invoice/set/edit/act/for/editing?historynetId — підтвердити акт`
  - Запит: `GET(без method) /protocol/act/invoice/set/warehouses/shipment/history?netId — підтвердити перевізника`
  - Валідація: для kind=act кнопка disabled поки не завантажився аудит (auditLoading/auditError/!auditStatistic); «Накладну не роздруковано» блокує обробку
  - Успіх: green notification, список і бейдж перезавантажуються (onCountChanged)
  - Помилка: setError банер
  - ⚠ мутація «set/…» іде GET-запитом без method:POST — потрапляє в дедуплікацію in-flight GET; повторний клік у ту саму мить може склеїтись
  - ⚠ підрахунок qty у shell ковтає помилки: catch → setEditingTotal(0)
- [ ] **Реєстр накладних — фільтр і друк** _(filter)_ — Таб «Реєстр накладних»: пошук (debounce), дата (одна), кнопка друку
  - Поля: Пошук (text); Дата* (date)
  - Запит: `GET /sales/get/register/invoice?value&limit&offset&from&to (from/to = межі дня)`
  - Запит: `GET /sales/get/register/invoice/document?... — друк/експорт`
  - Валідація: без дати — «Вкажіть дату», запит не йде
  - Успіх: модалка завантаження документа
  - Помилка: Alert/повідомлення в модалці
- [ ] **Звірка — фільтр і експорт** _(filter)_ — Таб «Звірка»: date range + мультиселект складів + кнопка експорту
  - Поля: Від/До (date); Склади* (CheckboxMultiSelect, GET /storages/all)
  - Запит: `GET /history/order/item/get/verification?from&to&limit&offset&storageId[]`
  - Запит: `GET /history/order/item/document/verification/create/export?... — Excel`
  - Валідація: якщо склади не вибрані — storageFilterError, дані не вантажаться
  - Успіх: таблиця/DownloadDocumentModal
  - Помилка: Alert

### `/warehouse/ukraine/orders/:id/placements (аліас /orders/ukraine/placement/:id)` — Розміщення замовлення на Україну (динамічні колонки)

- [ ] **Грід розміщення: inline-редагування кількостей по колонках** _(inline)_ — Клік по клітинці колонки дати; редагування qty
  - Поля: Кількість (int по клітинці)
  - Запит: `POST /supplies/ukraine/order/update — кнопка «Зберегти» (persistOrder), надсилає ВЕСЬ order з колонками`
  - Валідація: NaN/<0/сума по колонках > Qty позиції → red notification «Невірна кількість»; менше вже розміщеного → «Неможливо записати меншу кількість ніж розміщено…»; блокується якщо IsPlaced або isBusy
  - Успіх: isDirty скидається, order оновлюється з відповіді
  - Помилка: setError банер; notifications для валідаційних відмов
  - ⚠ зберігається цілий агрегат замовлення — конкурентне редагування перетирає чужі зміни
  - ⚠ операції «переміщення залишків»/оприходування вимагають попереднього збереження (клієнтський guard «Збережіть зміни перед…»)
- [ ] **Нова колонка розміщення (модалка)** _(action-modal)_ — Кнопка додавання колонки
  - Поля: Від якої дати* (date, дефолт сьогодні)
  - Запит: `POST /supplies/ukraine/order/update — одразу персистить order з новою колонкою`
  - Валідація: кнопка «Додати» disabled без дати; невалідна дата → жовтий notification «Вкажіть коректну дату»
  - Успіх: колонка зʼявляється в гріді
  - Помилка: error банер
- [ ] **Видалення колонки (confirm)** _(action-modal)_ — Іконка видалення на колонці → AppModal підтвердження
  - Запит: `POST /supplies/ukraine/order/update — якщо колонка вже збережена (Id>0); нова колонка видаляється локально`
  - Успіх: колонка зникає
  - Помилка: error банер
- [ ] **Дровер розміщень по клітинці (PlacementEditDrawer)** _(edit)_ — Відкриття клітинки з qty>0 (нульова кількість → red notification «Неможливо розмісти нульову кількість»)
  - Поля: позиції розміщення: місце/кількість
  - Запит: `(персист через POST /supplies/ukraine/order/update)`
  - Валідація: локальна в дровері (error банер); onApply тільки оновлює стан сторінки — персист кнопкою «Зберегти»
  - Успіх: дровер закривається, клітинка оновлена, isDirty=true
  - Помилка: Alert у дровері
- [ ] **Дровер незамовлених товарів (PlacementUnorderedProductsDrawer)** _(create)_ — Кнопка додавання незамовленого товару
  - Поля: Товар* (пошук за вендор-кодом, GET /products/search/vendorcode?limit=20&value); Кількість* (number)
  - Запит: `POST /supplies/ukraine/order/update — зберігає order з доданою позицією`
  - Валідація: «Оберіть товар і кількість» (red notification); кнопка disabled якщо !isValid
  - Успіх: green notification «Збережено»
  - Помилка: red notification «Не вдалося зберегти»
  - ⚠ catch без деталей — текст серверної помилки втрачається (порожній catch → generic message)
  - ⚠ пошук товару: catch {} мовчки ковтає помилку пошуку
- [ ] **Оприходування (confirm-модалка часткове/повне)** _(action-modal)_ — Кнопки оприходування (повне/часткове) → confirm
  - Поля: Склад* (select, GET /storages/all/nondefective); Дата оприходування* (date)
  - Запит: `POST /products/incomes/new/supply/ukraine/dynamic?fromDate&storageNetId — body весь order`
  - Валідація: без складу → «Оберіть склад»; isDirty → «Збережіть зміни перед оприходуванням»; невалідна дата → «Вкажіть коректну дату оприходування»
  - Успіх: green «Оприходування виконано», order перезавантажується/IsPlaced
  - Помилка: red notification «Не вдалося виконати оприходування»
  - ⚠ catch {} без параметра — реальна причина 4xx/5xx не показується користувачу

### `/product-delivery-protocols` — Протоколи доставки товару

- [ ] **Фільтр протоколів** _(filter)_ — Поля Організація/Постачальник/дати в filter-bar
  - Поля: Організація (text); Постачальник (text); Від/До (date)
  - Запит: `GET /delivery/product/protocol/all?limit&offset&organization&supplier&from&to`
  - Успіх: таблиця з пагінацією
  - Помилка: Alert
- [ ] **Новий протокол доставки (модалка)** _(create)_ — Кнопка «Додати»
  - Поля: Організація* (select searchable, GET /organizations/all); Тип (select: вантажівка/корабель/літак, дефолт вантажівка); Від якої дати* (datetime-local, дефолт зараз); Коментар (textarea)
  - Запит: `POST /delivery/product/protocol/new — FormData deliveryProductProtocolString=JSON (Created/Updated проставляються клієнтом, інакше сервер падає SqlDateTime overflow — «Помилка сервера»)`
  - Валідація: submitted-стиль: «Вкажіть організацію» / «Вкажіть дату» під полями
  - Успіх: redirect на /product-delivery-protocols/{NetUid}
  - Помилка: Alert createError у модалці
  - ⚠ критична залежність від клієнтських Created/Updated — регресія тут дає незрозумілу «Помилка сервера»
- [ ] **Експорт протоколів** _(action-modal)_ — Кнопка експорту (за активним date range)
  - Поля: попередження exportScopeWarning якщо фільтри звужують вибірку
  - Запит: `POST /delivery/product/protocol/print/documents?from&to — body масив колонок`
  - Успіх: модалка з посиланнями Excel/PDF
  - Помилка: downloadError в модалці
- [ ] **Row-actions модалка (ProtocolOptionsModal)** _(action-modal)_ — Клік по рядку — кнопки переходу: Логістика / Специфікації / Оприходування
  - Запит: `(тільки навігація)`
  - Успіх: перехід на під-сторінки
  - Помилка: —

### `/product-delivery-protocols/:id` — Протокол доставки — логістичний шлях

- [ ] **Зміна статусу протоколу (confirm)** _(action-modal)_ — Кнопка статусу в StatusSection → «Підтвердити зміну статусу»
  - Запит: `POST /delivery/product/protocol/update/status?netId`
  - Успіх: статус оновлюється в картці
  - Помилка: red notification
- [ ] **Привʼязка інвойсів до протоколу** _(action-modal)_ — Кнопка додавання інвойсів в InvoicesSection
  - Поля: чекбокси зі списку затверджених інвойсів
  - Запит: `GET /supplies/invoices/approved?netId&organizationNetId&transportationType — список`
  - Запит: `POST /delivery/product/protocol/add/supply/invoices — body протокол + вибрані інвойси`
  - Успіх: секція оновлюється з відповіді
  - Помилка: red notification / Alert у модалці
- [ ] **Документи інвойса (перегляд витрат + upload)** _(action-modal)_ — Кнопка Upload на картці інвойса
  - Поля: файли (multiple)
  - Запит: `GET /supplies/invoices/all/spending/get?netId — витрати інвойса`
  - Запит: `POST /supplies/invoices/documents/add — FormData invoice=JSON + documents[]`
  - Успіх: notification / оновлення протоколу
  - Помилка: red notification
  - ⚠ один catch {} у секції (рядок 117 InvoicesSection) ковтає деталі
- [ ] **Новий обʼєднаний сервіс (NewMergedServiceForm)** _(create)_ — Кнопка «Додати обʼєднаний сервіс» у MergedServicesSection
  - Поля: Постачальник послуг* (search select, GET /supplies/organizations/all/search); Договір* (залежить від постачальника); Тип послуги* (GET /consumables/categories/supply/services/get); Номер інвойса* (text); Витрати брутто/бухгалтерські (min одне з двох); відповідальні (GET /usermanagement/profiles/all/by?types=7) при увімкнених чекбоксах задач; валюти GET /currencies/all; файли: act/account/documents/taskDocuments/accountingTaskDocuments
  - Запит: `POST /supplies/services/merged/manage?netId={protocolNetId} — FormData mergedServiceString=JSON + файли`
  - Валідація: «Заповніть обовʼязкові поля»; «Заповніть управлінські або бухгалтерські витрати»; «Вкажіть відповідального за …» (3 варіанти)
  - Успіх: протокол оновлюється з відповіді, модалка закривається
  - Помилка: Alert validationError / red notification
  - ⚠ велика форма без useForm — валідація тільки на submit, поля не підсвічуються
- [ ] **Редагування обʼєднаного сервісу (MergedServiceEditCard)** _(edit)_ — Кнопка редагування на картці сервісу
  - Поля: ті самі поля + категорії файлів
  - Запит: `POST /supplies/services/merged/manage?netId — той самий ендпоінт`
  - Успіх: картка перерендерюється
  - Помилка: red notification
- [ ] **Розрахунок націнки сервісу (CalculateMergedServicesPanel)** _(action-modal)_ — Панель розрахунку по сервісу
  - Поля: тип націнки, auto/manual, інвойси сервісу
  - Запит: `POST /supplies/services/merged/update/extra/charge?extraChargeType&isAuto&serviceNetId — body SupplyInvoiceMergedServices[]`
  - Успіх: протокол оновлюється
  - Помилка: red notification
- [ ] **Привʼязка інвойсів до сервісу (AssignInvoicesToMergedServicePanel)** _(action-modal)_ — Панель привʼязки
  - Поля: чекбокси інвойсів (GET /supplies/invoices/get/by/services?serviceNetId)
  - Запит: `POST /supplies/services/merged/add/supply/invoices`
  - Успіх: оновлення
  - Помилка: red notification
- [ ] **Видалення сервісу** _(action-modal)_ — Кнопка видалення сервісу
  - Запит: `POST /supplies/services/merged/remove/before/calculated/gross/price?netId`
  - Успіх: сервіс зникає
  - Помилка: red notification
  - ⚠ видалення дозволене тільки до розрахунку gross price — обмеження серверне, на клієнті перевірити блокування кнопки

### `/product-delivery-protocols/:id/specifications` — Протокол доставки — специфікації (інвойси/пак-листи)

- [ ] **Завантаження специфікації з Excel (UploadProductSpecificationModal)** _(import)_ — Кнопка завантаження специфікації по інвойсу (пермішн ProductDeliveryProtocols_specifications_…)
  - Поля: Файл* (FileInput); конфіг парсингу: Код, Митна вартість, Митний код, Мито, Ціна, К-сть, Сума ПДВ, Від/До (рядки), номери колонок (NumberInput)
  - Запит: `POST /supplies/invoices/specification/upload?invoiceNetId — FormData parseConfiguration=JSON + file`
  - Запит: `GET /supplies/packinglists/specification/products/get?netId — рефреш гріда після успіху`
  - Валідація: вимога вибору інвойса — «Інвойс відсутній» / «В інвойсі відсутні пак лісти» (red notification)
  - Успіх: UploadProductSpecificationResultModal з результатом парсингу; грід оновлюється
  - Помилка: red notification з message помилки
  - ⚠ uploadRequestRef захищає від гонки, але результат з помилками (result modal) легко пропустити
- [ ] **Документи доставки інвойса (UploadDeliveryDocumentsModal)** _(edit)_ — Кнопка «Документи доставки» (окремий пермішн)
  - Поля: Постачальник послуг (select); Договір (select, залежний); Номер митної декларації (text); Дата митної декларації (date); файли .xls/.xlsx/.pdf (multiple), видалення/відновлення існуючих
  - Запит: `POST /supplies/invoices/documents/add — FormData invoice=JSON + documents[]`
  - Валідація: невалідна дата декларації → жовтий notification «Вкажіть коректну дату митної декларації»
  - Успіх: green «Документи збережено»
  - Помилка: red notification
  - ⚠ закриття з незбереженими змінами — confirm-модалка; видалення документа лише позначкою deleted до збереження
- [ ] **Обʼєднання інвойсів (MergeInvoicesModal)** _(action-modal)_ — Кнопка merge
  - Поля: чекбокси інвойсів протоколу (мінімум 2)
  - Запит: `POST /delivery/product/protocol/merge/supply/invoices?invoiceNetIds[]&netId`
  - Валідація: «Оберіть щонайменше два інвойси» (red notification)
  - Успіх: green «Інвойси успішно об'єднані», перезавантаження
  - Помилка: red notification
  - ⚠ незворотна операція без confirm-модалки з текстом наслідків
- [ ] **Редагування специфікації товару (ProductSpecificationEditDrawer)** _(edit)_ — Клік по рядку товару в гріді специфікації
  - Поля: Митний код (text); Митна вартість (number); Мито (number); ПДВ (number)
  - Запит: `POST /specifications/update?supplyInvoiceNetId — body Partial<ProductSpecificationEntity>`
  - Запит: `GET /supplies/packinglists/specification/products/get?netId — рефреш`
  - Валідація: поля disabled якщо !canSave (пермішн SPECIFICATION_CODES_ordersUkraine…)
  - Успіх: green «Зміни збережено», дровер закривається
  - Помилка: red notification
- [ ] **Завантаження специфікації (SpecificationDownloadModal)** _(action-modal)_ — Кнопка download по пак-листу
  - Запит: `GET /supplies/packinglists/specification/get?netId — повертає DocumentURL/PdfDocumentURL`
  - Успіх: посилання Excel/PDF
  - Помилка: текст помилки в модалці

### `/product-delivery-protocols/:id/product-income` — Протокол доставки — оприходування (динамічні розміщення пак-листа)

- [ ] **Вибір інвойса/пак-листа + грід оприходування** _(edit)_ — Селект інвойса → пак-лист; inline-редагування кількостей/ваги; чекбокси ReadyToPlace
  - Поля: К-сть по клітинках динамічних колонок; чекбокс «готово до розміщення» по рядку/всі
  - Запит: `GET /supplies/invoices/items/get?netId — інвойс з пак-листами (єдиний ендпоінт з колонками розміщень)`
  - Запит: `GET /supplies/packinglists/specification/products/get?netId`
  - Запит: `POST /supplies/packinglists/update — «Зберегти» (весь інвойс)`
  - Запит: `PATCH /supplies/packinglists/item/readytoplaced/update?netId&value — по рядку`
  - Запит: `PATCH /supplies/packinglists/item/readytoplaced/update/all?netId — всі`
  - Запит: `POST /supplies/invoices/items/update/vat — розрахунок ПДВ`
  - Запит: `GET /supplies/invoices/get/documents/pz?netId — документ PZ (модалка)`
  - Запит: `GET /storages/get/all/filtered?organizationNetId&skipDefective=false або GET /storages/all/nondefective — склади`
  - Валідація: guards: «Пак лист уже оприбуткований», «Збережіть зміни перед дією/переміщенням/розрахунком/проведенням» (red notifications)
  - Успіх: грід оновлюється з відповіді; PZ-модалка з посиланнями
  - Помилка: red notifications з message; error банер
  - ⚠ POST /supplies/packinglists/update повертає повний інвойс — а placement-info ендпоінт ні; переплутування дає «зникнення» гріда (задокументовано в коментарях)
  - ⚠ великий агрегат — конкурентні збереження перетирають
- [ ] **Дровер розміщень (ProtocolIncomePlacementDrawer)** _(edit)_ — Відкриття клітинки динамічної колонки
  - Поля: розміщення: місце + к-сть (maxQty обмежено)
  - Запит: `POST /supplies/ukraine/order/placements/dynamic/rows/new — новий рядок`
  - Запит: `POST /supplies/ukraine/order/placements/dynamic/rows/update — існуючий`
  - Успіх: дровер закривається, рядок оновлено
  - Помилка: error у дровері/банер
  - ⚠ окремий персист рядка поза загальним save — стан сторінки і сервера можуть розійтись до наступного reload
- [ ] **Нова колонка оприходування (NewIncomeDynamicColumnModal) + видалення колонки** _(action-modal)_ — Кнопки на панелі колонок
  - Поля: Від якої дати* (date)
  - Запит: `(персист через POST /supplies/packinglists/update)`
  - Валідація: «Вкажіть коректну дату» (жовтий)
  - Успіх: колонка в гріді
  - Помилка: notification
- [ ] **Проведення/оприходування пак-листа (2 confirm-модалки)** _(action-modal)_ — Кнопки «Провести»/«Оприходувати»
  - Поля: Склад* (select); Дата* (date)
  - Запит: `POST /products/incomes/new/packinglist/dynamic?fromDate&storageNetId — body пак-лист`
  - Валідація: «Виберіть склад», «Збережіть зміни перед проведенням/оприходуванням», «Вкажіть коректну дату»
  - Успіх: пак-лист позначається оприбуткованим
  - Помилка: red notification
  - ⚠ та сама пара кнопок з майже ідентичним флоу — легко переплутати сценарії при тестуванні

### `/orders/ukraine/all` — Всі замовлення Україна (таби: Поставки в Україну / Замовлення Україна)

- [ ] **Фільтр замовлень** _(filter)_ — filter-bar: дати, постачальник (debounce 400мс), валюта, тип (таб)
  - Поля: Від/До (date); Постачальник (text, live-пошук); Валюта (select, GET /currencies/all); Тип (toUkraine/direct)
  - Запит: `GET /supplies/ukraine/order/all/filtered?... — таб «Поставки в Україну»`
  - Запит: `GET /supplies/orders/all/uk/filtered?... — таб «Замовлення Україна»`
  - Успіх: фільтр зберігається (saveAllOrdersUkraineFilter) і відновлюється після create-флоу
  - Помилка: Alert
  - ⚠ реал-тайм reload по supplyOrderAdded/supplyOrderNotification
- [ ] **Row-actions модалка (OrderActionsModal)** _(action-modal)_ — Клік по рядку — кнопки за пермішнами: Оприходування/Документ оприходування/Огляд/Протоколи оплат/Логістика/Інвойси і пак листи/Специфікації/Офіційні витрати/Видалити
  - Запит: `(навігація на під-сторінки)`
  - Успіх: перехід зі state backgroundLocation (sheet-навігація)
  - Помилка: —
- [ ] **Видалення замовлення (confirm)** _(action-modal)_ — Кнопка «Видалити» в row-actions (пермішн)
  - Запит: `DELETE /supplies/ukraine/order/delete?netId — для toUkraine`
  - Запит: `DELETE /supplies/orders/delete?netId — для direct`
  - Успіх: green notification, reload списку
  - Помилка: red notification з текстом помилки
  - ⚠ isDeleting глушить подвійний сабміт, але модалка не показує що саме видаляємо крім назви
- [ ] **Друк списку замовлень** _(action-modal)_ — Іконка «Завантажити» в filter-bar (пермішн print)
  - Запит: `POST /supplies/orders/print/documents?from&to — body колонки`
  - Успіх: DownloadDocumentModal з Excel/PDF
  - Помилка: downloadError
- [ ] **Офіційні витрати доставки (OfficialCostsModal)** _(edit)_ — Кнопка в row-actions для поставки в Україну
  - Поля: Постачальник послуг* (search select, GET /supplies/organizations/all/search, debounce); Договір* (залежний select); Тип* (GET /consumables/categories/supply/services/get); Номер інвойса* (text); Вартість брутто (number); ПДВ % (number); бухгалтерські аналоги; Дата (datetime); файли акту (тільки при створенні)
  - Запит: `POST /supplies/ukraine/order/new/delivery-expenses — FormData deliveryExpensesString=JSON + act[] (створення)`
  - Запит: `POST /supplies/ukraine/order/update/delivery-expenses — JSON body (оновлення, БЕЗ файлів)`
  - Валідація: «Заповніть організацію, договір, тип і номер інвойса»; «Поставка не завантажена»
  - Успіх: green «Офіційні витрати доставки збережено», модалка закривається, reload
  - Помилка: Alert error у модалці
  - ⚠ при update файли акту не передаються — додати документ можна лише при створенні
  - ⚠ числові поля конвертуються Number(x||0) — порожнє = 0 без попередження

### `/orders/ukraine/all/new і /orders/ukraine/to-ukraine/new` — Нове замовлення Україна / Нова поставка в Україну (створення з Excel)

- [ ] **Створення замовлення з Excel-файлу** _(create)_ — Дровер відкривається одразу по роуту; submit кнопкою (form id=supply-ukraine-order-create-form)
  - Поля: Дата* (datetime); Номер накладної / Дата накладної (для direct); Постачальник* (select, GET /clients/all/manufacturers); Організація* (залежна від постачальника); Договір* (залежний); Коментар; Файл* (FileInput, тільки Excel); конфіг парсингу: Код товару*, Кількість*, З рядка/До рядка, Колонка ціни/суми (взаємовиключно через withTotalAmount), Вага нетто/брутто + колонки, Код специфікації + колонка, Імпортний товар + колонка
  - Запит: `POST /supplies/orders/new/file — FormData file+parseConfiguration+supplyOrder (direct)`
  - Запит: `POST /supplies/ukraine/order/new/supplier/file — FormData file+parseConfiguration+orderUkraine (to-Ukraine)`
  - Запит: `GET /organizations/all, GET /clients/all/manufacturers, GET /currencies/all — довідники`
  - Валідація: послідовні перевірки: «Оберіть постачальника, організацію та договір» → «Оберіть дату» → «Оберіть Excel файл» → «Заповніть колонки імпорту» (Alert)
  - Успіх: якщо відповідь без помилок парсингу — green «Замовлення створено» + redirect на список/деталі з відновленням фільтра; якщо HasError — red «Файл містить помилки» + UploadErrorsAlert з переліком рядків
  - Помилка: Alert error угорі форми; кнопка loading isSaving
  - ⚠ зміна постачальника/організації/файла мовчки скидає uploadResponse — попередні помилки зникають
  - ⚠ часткове створення на сервері при помилках парсингу треба перевірити вручну

### `/orders/ukraine/view/:id` — Огляд поставки в Україну

- [ ] **Перерахунок ПДВ замовлення** _(action-modal)_ — Кнопка перерахунку ПДВ
  - Запит: `POST /supplies/ukraine/order/vat/percent/add — body order`
  - Успіх: green «ПДВ перераховано», order оновлюється
  - Помилка: red «Не вдалося перерахувати ПДВ»
  - ⚠ generic текст помилки — серверна причина губиться
- [ ] **Inline ПДВ у рядках позицій** _(inline)_ — Редагування ПДВ% у рядках таблиці позицій → кнопка «Зберегти»
  - Поля: ПДВ % (number по рядку)
  - Запит: `POST /supplies/ukraine/order/item/update?netId={orderNetId} — body тільки змінені позиції`
  - Успіх: green «ПДВ у рядках збережено»
  - Помилка: red «Не вдалося зберегти ПДВ у рядках»
- [ ] **Документи замовлення (SupplyUkraineOrderDocumentsModal)** _(edit)_ — Кнопка «Документи»
  - Поля: нові файли .xls/.xlsx/.pdf (multiple); toggle Deleted на існуючих
  - Запит: `POST /supplies/ukraine/order/documents/manage — FormData orderInString=JSON + documents[]`
  - Валідація: закриття з незбереженими змінами → confirm-модалка
  - Успіх: green «Документи збережено», таблиця документів оновлюється
  - Помилка: red «Не вдалося зберегти документи»

### `/orders/ukraine/all/edit/:id (та .../edit/:id/new)` — Деталі прямого замовлення Україна

- [ ] **Редагування суми/дати замовлення** _(inline)_ — Режим редагування «Сума замовлення» + «Від якої дати» + «Час»
  - Поля: Сума замовлення (number); Від якої дати (date); Час (time)
  - Запит: `POST /supplies/orders/update — body весь order з патчем`
  - Успіх: green notification успіху
  - Помилка: red notification з message
- [ ] **Завантаження файла документа доставки** _(action-modal)_ — Іконка Upload на документі
  - Поля: файл
  - Запит: `POST /supplies/documents/upload — FormData`
  - Успіх: green «Документ завантажено»
  - Помилка: red notification
- [ ] **Зміна статуса документа доставки (модалка)** _(action-modal)_ — Іконка статусу документа
  - Поля: Отримано (checkbox); Коментар (text)
  - Запит: `POST /supplies/orders/update — статус зберігається в агрегаті`
  - Валідація: немає
  - Успіх: модалка закривається
  - Помилка: red notification
- [ ] **Кредит-нота (модалка)** _(create)_ — Кнопка створення кредит-ноти
  - Поля: Номер (text); Сума (number); Дата (date); Коментар; файли (з видаленням)
  - Запит: `POST /supplies/orders/upload/creditnote?netId — FormData`
  - Успіх: green «Кредит ноту створено»
  - Помилка: red notification
  - ⚠ обовʼязковість полів не валідується на клієнті
- [ ] **Проформа (DirectSupplyOrderProFormCard)** _(edit)_ — Картка проформи: редагування Номер/Сума нетто/Дата + upload файлів
  - Поля: Номер; Сума нетто (number); Дата (datetime); файли proFormFiles
  - Запит: `POST /supplies/proforms/upload/documents?netId — FormData proForm=JSON + proFormFiles[]`
  - Запит: `DELETE /supplies/proforms/delete/document?netId — видалення документа`
  - Успіх: green «Проформу збережено» / «Документ видалено»
  - Помилка: red notification
  - ⚠ видалення документа без confirm
- [ ] **Платіжні задачі/протоколи інвойса (DirectOrderPaymentTasksCard)** _(edit)_ — Селект інвойса → секція протоколів оплат
  - Поля: ключ протоколу (GET /supplies/orders/payments/all/keys); відповідальний (GET /usermanagement/profiles/all/by?types=7); дата/сума
  - Запит: `GET /supplies/invoices/items/get?netId — інвойс з протоколами`
  - Запит: `POST /supplies/invoices/update?netId={orderNetUid} — збереження протоколів`
  - Успіх: інвойс перезавантажується
  - Помилка: reportError → Alert/notification

### `/orders/ukraine/all/edit/:id/supply-invoices` — Інвойси і пак-листи прямого замовлення

- [ ] **Імпорт інвойса з файлу** _(import)_ — Кнопка завантаження інвойса (пермішн; інакше «Недостатньо прав для цієї дії»)
  - Поля: файл Excel; конфіг колонок імпорту
  - Запит: `POST /supplies/invoices/update/file — FormData`
  - Валідація: валідаційні red notifications: «Оберіть інвойс», «Перевірте колонки імпорту», validationMessage
  - Успіх: green «Інвойс завантажено»
  - Помилка: red notification з message
- [ ] **Імпорт пак-листа з файлу** _(import)_ — Кнопка завантаження пак-листа
  - Поля: файл Excel; конфіг колонок
  - Запит: `POST /supplies/packinglists/new/file — FormData`
  - Успіх: green «Пак лист завантажено»
  - Помилка: red notification
- [ ] **Збереження рядків інвойсів (inline)** _(inline)_ — Редагування кількостей/цін у гріді → «Зберегти»
  - Поля: рядки інвойса
  - Запит: `POST /supplies/invoices/items/update — body інвойс`
  - Валідація: «Кількості інвойсів не збігаються» — контроль сум
  - Успіх: green «Рядки інвойсів збережено»
  - Помилка: red notification
- [ ] **Збереження пак-листів (inline)** _(inline)_ — Редагування пак-листів → «Зберегти»
  - Поля: рядки пак-листів
  - Запит: `POST /supplies/packinglists/update — body інвойс з пак-листами`
  - Валідація: «Кількості пак листів не збігаються»
  - Успіх: green «Пак листи збережено»
  - Помилка: red notification
- [ ] **Збереження інвойса + документи** _(edit)_ — Форма інвойса (номер/дати/документи) → «Зберегти»
  - Поля: атрибути інвойса; нові документи; видалені документи
  - Запит: `POST /supplies/invoices/update?netId — інвойс`
  - Запит: `DELETE /supplies/invoices/delete/document?netId — паралельний Promise.all по видалених`
  - Запит: `POST /supplies/invoices/upload/documents — нові файли`
  - Успіх: green «Інвойс збережено» / «Протоколи інвойса збережено»
  - Помилка: red notification
  - ⚠ 3 запити послідовно без транзакції — при падінні середнього стан частково збережений
- [ ] **Збереження пак-листа + документи** _(edit)_ — Форма пак-листа → «Зберегти»
  - Поля: атрибути пак-листа; документи
  - Запит: `POST /supplies/packinglists/update`
  - Запит: `POST /supplies/packinglists/upload/documents — FormData`
  - Успіх: green «Пак лист збережено»
  - Помилка: red notification
- [ ] **Видалення інвойса / пак-листа (confirm)** _(action-modal)_ — Кнопки видалення з confirm-модалкою
  - Запит: `DELETE /supplies/invoices/delete?netId`
  - Запит: `DELETE /supplies/packinglists/delete?netId`
  - Успіх: green «Інвойс видалено» / «Пак лист видалено»
  - Помилка: red notification

### `/orders/ukraine/all/edit/:id/specifications (та /orders/develop/all/edit/:id/specifications)` — Специфікації прямого замовлення

- [ ] **Завантаження специфікації з Excel** _(import)_ — Кнопка upload по інвойсу (переиспользует UploadProductSpecificationModal)
  - Поля: файл + конфіг парсингу (як у протоколів доставки)
  - Запит: `POST /supplies/invoices/specification/upload?invoiceNetId — FormData`
  - Успіх: result-модалка; грід оновлюється
  - Помилка: red notification
- [ ] **Документи доставки інвойса** _(edit)_ — UploadDeliveryDocumentsModal
  - Поля: постачальник послуг/договір/номер+дата митної декларації/файли
  - Запит: `POST /supplies/invoices/order/documents/add — FormData (окремий direct-ендпоінт!)`
  - Запит: `GET /supplies/invoices/items/get?netId — рефреш`
  - Валідація: «Вкажіть коректну дату митної декларації» (жовтий)
  - Успіх: green «Документи збережено»
  - Помилка: red notification
  - ⚠ інший ендпоінт ніж у протоколів (/supplies/invoices/documents/add) — тестувати окремо
- [ ] **Редагування специфікації товару (дровер)** _(edit)_ — Клік по рядку (ProductSpecificationEditDrawer)
  - Поля: Митний код/вартість/Мито/ПДВ
  - Запит: `POST /specifications/update?supplyInvoiceNetId`
  - Успіх: green «Зміни збережено»
  - Помилка: red notification
  - ⚠ specificationSaveRequestRef проти гонок — перевірити швидкі повторні збереження

### `/orders/ukraine/all/edit/:id/product-income` — Оприходування прямого замовлення (SupplyUkraineDirectOrderProductIncomePage)

- [ ] **Ті самі форми, що на /product-delivery-protocols/:id/product-income** _(edit)_ — сторінка рендерить той самий income-компонент у режимі прямого замовлення (джерело income: GET /products/incomes/get/supply/order?netId)
  - Поля: див. сторінку оприходування протоколу
  - Запит: `GET /products/incomes/get/supply/order?netId — статус оприходування`
  - Запит: `решта — як у /product-delivery-protocols/:id/product-income`
  - Успіх: аналогічно
  - Помилка: аналогічно
  - ⚠ перевірити, що direct-режим бере правильне income-джерело (direct vs toUkraine ендпоінти в directOrderProductIncomeApi.ts)

### `/orders/ukraine/:id/product-income та /supply-orders/product-placement/:id` — Документ оприходування замовлення (перегляд)

- [ ] **Експорт документа оприходування** _(action-modal)_ — Кнопка Excel/PDF документа (read-only сторінка розміщень)
  - Запит: `GET /products/incomes/supply/order/get?netId — direct (/supply-orders/product-placement/:id)`
  - Запит: `GET /products/incomes/supply/order/ukraine/get?netId — ukraine (/orders/ukraine/:id/product-income)`
  - Запит: `GET /products/incomes/document/export?netId — формування документа`
  - Успіх: модалка з посиланнями Excel/PDF
  - Помилка: setError → Alert «Не вдалося сформувати документ»
  - ⚠ сторінка read-only — форм вводу немає; перевірити пусті стани коли income відсутній

### `/orders/ukraine/protocols/:netid` — Протоколи оплат поставки в Україну

- [ ] **Протоколи оплат (PaymentDeliveryProtocolsSection)** _(edit)_ — Додавання/редагування рядків протоколів оплат замовлення
  - Поля: Форма платежу* (select, GET /supplies/ukraine/order/protocols/keys/all); Вартість брутто* (number); Відсоток* (number); дата, відповідальний (GET /usermanagement/profiles/all/by?types=7)
  - Запит: `POST /supplies/ukraine/order/update — body весь order з протоколами`
  - Валідація: «Оберіть форму платежу», «Введіть вартість брутто», «Введіть відсоток», «Сума платежів не може бути більшою за суму замовлення» (2 перевірки)
  - Успіх: order оновлюється з відповіді
  - Помилка: Alert validationError у секції; red notification при падінні
  - ⚠ знову збереження всього агрегата замовлення
- [ ] **Обʼєднаний сервіс Україна (NewMergedServiceForm)** _(create)_ — Кнопка додавання сервісу в MergedServicesSection
  - Поля: постачальник послуг*/договір*/тип*/номер інвойса*; витрати управлінські/бухгалтерські (min одне); файли документів
  - Запит: `POST /supplies/services/merged/upload/documents/ukraine?netId={orderNetId} — FormData entity=JSON + documents[]`
  - Валідація: «Заповніть обовʼязкові поля», «Заповніть управлінські або бухгалтерські витрати», «Значення не можуть бути відʼємними»
  - Успіх: order оновлюється
  - Помилка: Alert

### `/orders/depreciated` — Акти списання

- [ ] **Фільтр актів списання** _(filter)_ — date range у filter-bar; infinite scroll (load more)
  - Поля: Від/До (date)
  - Запит: `GET /orders/depreciated/all/filtered?from&to&limit&offset`
  - Валідація: порожні/from>to → filterError
  - Успіх: дозавантаження сторінок
  - Помилка: Alert «Не вдалося завантажити наступні акти списання»
- [ ] **Створення акта списання з Excel (модалка)** _(create)_ — Кнопка «Додати» (form id=depreciated-order-create-form)
  - Поля: Склади* (select, GET /storages/get/all); Від якої дати* (date); Управ. (checkbox IsManagement); конфіг парсингу: Код Виробника*, Кількість*, Від/До рядки; Коментар; Завантажте документ* (файл)
  - Запит: `POST /orders/depreciated/file/new — FormData`
  - Валідація: validateCreateForm + «Заповніть склад, файл і конфігурацію імпорту» (Alert у модалці)
  - Успіх: green «Акт списання створено»; якщо exceptions — жовтий «створено з попередженнями» + DepreciatedOrderExceptionsModal зі списком
  - Помилка: createError Alert у модалці, модалка лишається відкритою
  - ⚠ часткове створення з попередженнями — легко пропустити модалку exceptions
- [ ] **Деталі акта + експорт (дровер)** _(action-modal)_ — Клік по рядку
  - Запит: `GET /orders/depreciated/get?netId`
  - Запит: `GET /orders/depreciated/document/export?netId`
  - Успіх: дровер з позиціями; download-модалка
  - Помилка: Alert

### `/supplies/returns` — Повернення постачальникам

- [ ] **Фільтр повернень** _(filter)_ — date range Від/До + скидання
  - Поля: Від/До (date)
  - Запит: `GET /supplies/returns/all/filtered?from&to&limit&offset`
  - Успіх: таблиця, пагінація
  - Помилка: Alert
- [ ] **Деталі повернення + експорт** _(action-modal)_ — Іконка «Деталі» в рядку; кнопка завантаження в деталях (disabled без NetUid)
  - Запит: `GET /supplies/returns/get?netId`
  - Запит: `GET /supplies/returns/document/export?netId`
  - Успіх: модалка «Завантажити» з Excel/PDF посиланнями
  - Помилка: текст помилки
  - ⚠ сторінка read-only — create/edit відсутні

### `/transporters` — Перевізники

- [ ] **Фільтр перевізників** _(filter)_ — Пошук (client-side), Статус (активні/архівні), рейка типів зліва
  - Поля: Пошук (text); Статус (select); Тип перевізника (rail, GET /transporters/types/all)
  - Запит: `GET /transporters/all/type?netId={typeNetId} — при виборі типу`
  - Успіх: список перевантажується
  - Помилка: Alert
- [ ] **Створення/редагування перевізника (TransporterEditorModal)** _(create)_ — Кнопка «Додати» (disabled без вибраного типу) або дія «Редагувати» в row-actions
  - Поля: Назва* (text); Пріоритет (number-текст); інші атрибути + логотип (FormData)
  - Запит: `POST /transporters/new — FormData (створення)`
  - Запит: `POST /transporters/update — FormData (редагування)`
  - Валідація: validateTransporterForm: «Вкажіть назву перевізника», «Вкажіть коректний пріоритет»; «Оберіть тип перевізника»
  - Успіх: green notification, список перезавантажується
  - Помилка: Alert formError у модалці
- [ ] **Архівація перевізника (confirm)** _(action-modal)_ — Row-actions → «Архівувати» → confirm-модалка (canArchive)
  - Запит: `GET(без method!) /transporters/delete?netId`
  - Успіх: green notification, список оновлюється
  - Помилка: red notification
  - ⚠ мутація archiveTransporter іде GET-запитом без method — дедуплікація in-flight GET може проковтнути повторну спробу; семантично має бути DELETE

### `/basket-supply-ukraine-order (+ /*)` — Кошик поставки Україна (таби: Кошик / Фактури / Кокпіт закупівель / Рекомендації / Дашборд / Бюджетний кошик)

- [ ] **Імпорт позицій кошика з Excel (BasketSupplyUploadModal)** _(import)_ — Кнопки «Імпорт»/«Прев'ю» на табі Кошик; дві моди upload/preview
  - Поля: Завантажити файли* (FileInput); конфіг: Код Виробника, К-сть, Від/До рядки, Від якої дати, Приорітет (NumberInput)
  - Запит: `POST /supplies/ukraine/order/cart/items/file/upload — FormData (повний імпорт)`
  - Запит: `POST /supplies/ukraine/order/cart/items/file/select/preview — FormData (превʼю → PreviewCartItemsModal)`
  - Успіх: green notification, кошик перезавантажується (GET /supplies/ukraine/order/cart/items/all)
  - Помилка: uploadError у модалці
- [ ] **Резерв позиції кошика (модалка)** _(action-modal)_ — Кнопка резерву на рядку кошика
  - Поля: кількість резерву
  - Запит: `POST /supplies/ukraine/order/cart/items/update — body позиція`
  - Успіх: green notification, рядок оновлюється
  - Помилка: red notification
- [ ] **Створення документа з кошика (TaxFree/SAD)** _(create)_ — Перенесення позицій у праву панель → кнопка створення → модалка з DocumentTargetControls
  - Поля: Тип документа (SegmentedControl taxFree/sad); Вибрати існуючий (switch); Упаковки (не проведені) (select існуючого документа: GET /supplies/ukraine/order/packlists/taxfree/all/notsent або /supplies/ukraine/order/packlists/sad/all/notsent)
  - Запит: `POST /supplies/ukraine/order/packlists/taxfree/update — створення/оновлення TaxFree пак-листа`
  - Запит: `POST /supplies/ukraine/order/packlists/sad/update — SAD`
  - Запит: `POST /supplies/ukraine/order/cart/items/totals/calculate — тотали панелі`
  - Валідація: «Оберіть позиції для документа» якщо права панель порожня; кнопка disabled без destinationItems
  - Успіх: green «Документ створено: {number}», redirect на створений документ, кошик очищується і reload
  - Помилка: createError Alert у модалці
  - ⚠ після успіху йде ланцюг reload + navigate — при падінні loadReferenceDocuments стан може бути неповний
- [ ] **Створення документа з фактур (таб «Фактури»)** _(create)_ — Фільтр продажів (GET /sales/all/filtered/pl-uk?from&to&value) → перенесення в праву панель → модалка створення
  - Поля: ті самі DocumentTargetControls (sale-варіанти списків: …/taxfree/all/notsent/sale, …/sad/all/notsent/sale)
  - Запит: `POST /supplies/ukraine/order/packlists/taxfree/update/sale`
  - Запит: `POST /supplies/ukraine/order/packlists/sad/update/sale`
  - Запит: `POST /supplies/ukraine/order/cart/items/sale/totals/calculate — тотали`
  - Валідація: «Оберіть фактури для документа»; «Оберіть фактури одного клієнта» (жовтий); «Спочатку оберіть одну фактуру…»
  - Успіх: green «Документ створено», redirect
  - Помилка: createError Alert
- [ ] **Кокпіт закупівель (BuyerCockpitTab / ProcurementConstructor)** _(edit)_ — Вибір виробника → план закупівлі; редагування умов; фідбек; створення чернетки замовлення
  - Поля: налаштування виробника (профіль); умови по товару; фідбек по рекомендаціях; конструктор: додавання позицій у кошик замовлення
  - Запит: `POST /procurement/producer/plan — план виробника`
  - Запит: `POST /procurement/masters/producer — upsert профілю (green «Налаштування виробника збережено»)`
  - Запит: `POST /procurement/masters/product-terms — upsert умов товару`
  - Запит: `POST /procurement/feedback — фідбек`
  - Запит: `POST /supplies/ukraine/order/new/cockpit — чернетка замовлення (green «Чернетку замовлення створено»)`
  - Запит: `GET /supplies/ukraine/order/cart/items/recommendations — рекомендації`
  - Успіх: green notifications по кожній дії; «Додано {n} позицій у кошик»
  - Помилка: red notifications
  - ⚠ ProcurementConstructor має кілька .catch(() => undefined) — помилки завантаження плану/чартів ковтаються мовчки
  - ⚠ сесії конструктора зберігаються локально (procurementSessions) — не серверний стан
- [ ] **Бюджетний кошик (BudgetCartTab)** _(filter)_ — Бюджет EUR + метод оптимізації + дата → розрахунок
  - Поля: Бюджет (number); Метод (select greedy/…); Станом на (date)
  - Запит: `POST /procurement/cart — body {asOfDate,budgetEur,method}`
  - Успіх: таблиця плану + підсумки + гайд
  - Помилка: Alert; один catch {} на автозапуску мовчки ігнорує помилку
  - ⚠ перший автозапит ковтає помилку (catch {} на рядку 90)

## Модуль ПРОДАЖІ — 20 сторінок, 62 форм

> Усі шляхи apiRequest формуються як /api/v1/{lang}{path} (lang за замовчуванням uk, з config VITE_API_LANGUAGE). Нижче префікс скорочено до /api/v1/uk.
> Мутації продажів (createSale/updateSale/updateMergedSale/orders items) ідуть з idempotency-заголовком операції (SALES_IDEMPOTENCY_HEADER) та persistent-mutation-механізмом (usePersistentSaleJsonMutation/FileMutation): при збої операція зберігається в localStorage і пропонує reconcile/replay — QA має перевірити повторний сабміт після F5 та подвійний клік.
> GET-запити дедуплікуються apiClient (спільний in-flight на 120с) — однакові фільтри на двох вкладках компонентів дають один запит.
> 401 → тихий refresh POST /api/v1/uk/usermanagement/token/refresh і повтор; 401/403 після refresh → clearSession + редірект на логін.
> apiClient показує повідомлення з envelope.Message сервера; якщо його нема — «Не вдалося виконати запит».
> Спільний ризик: майже всі довідникові GET (organizations, managers, transporters) мають порожній catch → при падінні довідника селект просто порожній, без повідомлення.
> NewSaleWizard (~40 файлів) — окремий великий майстер створення/редагування продажу; тут описаний за ключовими запитами, детальні кроки варто тестувати окремим чеклистом.

### `/sales/ukraine/all` — Продажі Україна (всі)

- [ ] **Фільтр-бар списку продажів** _(filter)_ — верхній app-filter-bar на сторінці
  - Поля: Період з/по (date); Статус (Select: All/…); Менеджер (Select: Усі/Тільки мої → type=All|Self); Організації (multi-checkbox popover); Клієнт (пошук SalesClientSearch); Інтернет-магазин (Checkbox forEcommerce); Пошук (text, debounce 300мс, trim)
  - Запит: `GET /api/v1/uk/sales/all/filtered?clientId&fastEcommerce=false&forEcommerce&from&to&limit&offset&organisationIds&status&type&value — при кожній зміні фільтра/сторінки`
  - Запит: `GET /api/v1/uk/organizations/all — довідник організацій при монтуванні`
  - Запит: `GET /api/v1/uk/clients/all/filtered?filterSql=RegionCode.Value/Client.FullName&limit=50 — пошук клієнта у фільтрі`
  - Валідація: немає обмежень дат; пошук лише trim
  - Успіх: грид оновлюється; при reload існуючі рядки лишаються з класом is-reloading (без скелетона); realtime-події saleAdded/saleUpdated тригерять фоновий reload через 800мс
  - Помилка: червоний Alert над гридом з message від сервера; фоновий realtime-reload помилки ковтає (isBackgroundReload)
  - ⚠ порожній catch на organizations → мовчки порожній селект
  - ⚠ при фоновому reload помилка не показується взагалі
- [ ] **Майстер «Новий продаж» (NewSaleWizard, також редагування через onOpenEditor)** _(create)_ — кнопка «Новий продаж» (disabled без права canCreateSale) або дія редагування в рядку
  - Поля: Крок 1: клієнт* (пошук), договір/угода*; Крок 2: товари (пошук по вендор-коду/advanced), кількість, ціни, знижки, аналоги, крос-сейл; Крок 3: перегляд/підтвердження, отримувач доставки, документи
  - Запит: `GET /api/v1/uk/clients/all/filtered — пошук клієнта`
  - Запит: `GET /api/v1/uk/sales/all/register — реєстр продажів клієнта`
  - Запит: `GET /api/v1/uk/clients/get/debt/grouped, /clients/get/debt/total(/structure) — борги`
  - Запит: `GET /api/v1/uk/agreements/client/all?netId — договори`
  - Запит: `GET /api/v1/uk/products/search/advanced, /products/get/analogues, /products/availabilities/all, /products/all/availabilities/product, /products/reservations/current/carousel/agreement, /products/pricings/current, /products/pricings/all — товари/наявність/ціни`
  - Запит: `GET /api/v1/uk/sales/get/current?netId, /sales/get/current/unmerged — поточний кошик`
  - Запит: `POST /api/v1/uk/orders/items/new?clientAgreementNetId&saleNetId — додати позицію`
  - Запит: `POST /api/v1/uk/orders/items/update — змінити позицію`
  - Запит: `DELETE /api/v1/uk/orders/items/delete?orderItemNetId — видалити позицію`
  - Запит: `PATCH /api/v1/uk/sales/switch?clientAgreementNetId&saleNetId — переключення кошика`
  - Запит: `POST /api/v1/uk/sales/new — фінальне створення (idempotency header)`
  - Запит: `POST /api/v1/uk/sales/update/merged — об'єднаний продаж`
  - Запит: `POST /api/v1/uk/orders/items/shift/specific — зсув позиції`
  - Запит: `POST /api/v1/uk/sales/reservations/new — резервація`
  - Запит: `POST /api/v1/uk/deliveries/recipients/new, /deliveries/recipients/addresses/new, /sales/update/recipient, /sales/update/recipient/address — отримувач`
  - Запит: `GET /api/v1/uk/supplies/orders/arrival/nearest/get — майбутня резервація (FutureReservationModal)`
  - Валідація: покроково: без клієнта/договору не пройти далі; кількість перевіряється проти доступності; merged-сабміт кидає помилки «позиція не має ідентифікатора»/«позиція передана двічі»
  - Успіх: onCreated → закриття майстра + reload списку; повідомлення з Message сервера (postSaleWithMessage)
  - Помилка: ApiError з Message сервера; незавершена операція зберігається в pendingSalesMutationRegistry і вимагає reconcile при повторному відкритті
  - ⚠ величезний майстер — тестувати окремо: подвійний Enter (wizardEnterLatch), розрив мережі під час POST /sales/new (idempotency replay), спліт продажу (wizardSplitSale/FinalSplitRecovery)
  - ⚠ postSaleWithMessage при 401 робить fallback-повтор через apiRequest — можливий подвійний POST на сервері, якщо перший таки пройшов
- [ ] **Модалка знижки (SaleDiscountModal, і для рядка, і для позиції)** _(action-modal)_ — дія «Знижка» в рядку гриду або в розгорнутій позиції
  - Поля: Відсоток знижки (NumberInput; заблоковано без права); Коментар* (обов'язковий; для packaging-режиму — лише коментар)
  - Запит: `GET /api/v1/uk/sales/get?netId — force-гідрація продажу перед відкриттям`
  - Запит: `POST /api/v1/uk/sales/discount/update — збереження (persistent mutation, replay після збою)`
  - Валідація: коментар обов'язковий («Коментар обов'язковий»); відсоток — «Некоректний відсоток»; кнопка disabled без canEditComment
  - Успіх: зелена нотифікація «Знижку/Коментар збережено», оновлення рядка в списку + reload
  - Помилка: червона нотифікація з message; поля disabled при discountMutation.hasPending
  - ⚠ якщо позиція змінилася на сервері — «Позиція продажу вже змінилася. Оновіть список» (перевірити гонку двох вкладок)
- [ ] **Дровер даних доставки (SaleDetailsDrawer)** _(edit)_ — дія «Деталі/доставка» в рядку
  - Поля: Тип перевізника (Select); Перевізник (Select, залежний); Номер декларації/ТТН (text); Місто (text); файл документа (FileInput)
  - Запит: `GET /api/v1/uk/transporters/types/all — типи`
  - Запит: `GET /api/v1/uk/transporters/all/type/hidden?netId — перевізники за типом`
  - Запит: `POST /api/v1/uk/sales/update/file — FormData(sale JSON + file), persistent file mutation`
  - Валідація: клієнтської майже немає; кнопка loading=isSaving; поля disabled при reconciliationRequired
  - Успіх: зелена нотифікація «Дані доставки збережено», закриття, reload
  - Помилка: червона нотифікація; при збої з файлом — вимога перевибрати файл (requiresFileReselection)
  - ⚠ перевірити reconcile-сценарій: збій POST з файлом → повторне відкриття вимагає file re-select
- [ ] **Дровер «Акт редагування» (SaleEditDrawer, зсув позицій)** _(edit)_ — дія редагування акту (onOpenEditShift)
  - Поля: кількості/склади позицій до зсуву (NumberInput per-row)
  - Запит: `GET /api/v1/uk/sales/get/shifted?netId — завантаження shifted-стану`
  - Запит: `POST /api/v1/uk/orders/items/shift/current — виконання зсуву (idempotency header)`
  - Валідація: поля disabled при isMutationLocked/isSaving
  - Успіх: зелена нотифікація «Зсув виконано», закриття, reload
  - Помилка: червона нотифікація з message
  - ⚠ перевірити зсув при паралельній зміні продажу іншим користувачем
- [ ] **Налаштування ТТН (ConsignmentNoteSettingsDrawer)** _(edit)_ — дія «ТТН» в рядку (onOpenConsignment)
  - Поля: профіль налаштування (Select/список); Пункт розвантаження (UnloadingPoint)*, інші текстові поля перевізника
  - Запит: `GET /api/v1/uk/consignment/note/settings/all/get?forReSale=false — список`
  - Запит: `POST /api/v1/uk/consignment/note/settings/add?forReSale=false — створення`
  - Запит: `POST /api/v1/uk/consignment/note/settings/update?forReSale=false — оновлення`
  - Запит: `POST /api/v1/uk/consignment/note/settings/remove?forReSale=false&netId — видалення`
  - Запит: `POST /api/v1/uk/consignment/note/settings/print/document?forReSale=false&netId={saleNetId} — друк ТТН`
  - Валідація: валідація UnloadingPoint та обов'язкових полів перед друком; кнопки disabled: Скинути/Зберегти без isEdited, Друк loading=isPrinting
  - Успіх: нотифікації «Налаштування збережено/видалено»; друк відкриває документ
  - Помилка: червоні нотифікації в catch кожної дії
  - ⚠ видалення без окремого підтвердження — лише кнопка
- [ ] **Меню документів продажу (SaleDocumentsMenu)** _(action-modal)_ — кнопка друку в рядку
  - Поля: вибір типу документа (рахунок, лист відвантаження, платіжний, ПЗ, історичні)
  - Запит: `GET /api/v1/uk/sales/get/last/document?netId`
  - Запит: `GET /api/v1/uk/sales/shipment/list/print/documents?netId`
  - Запит: `GET /api/v1/uk/sales/get/payment/document?netId`
  - Запит: `GET /api/v1/uk/sales/get/document/pz?netId`
  - Запит: `GET /api/v1/uk/sales/get/document/history?netId&historyNetId`
  - Запит: `GET /api/v1/uk/sales/get/shifted/document?netId`
  - Запит: `GET /api/v1/uk/sales/get/shifted/hisotry/document?netId&historyNetId (typo 'hisotry' в шляху — так на бекенді)`
  - Запит: `GET /api/v1/uk/sales/shipment/list/print/documents/history`
  - Валідація: —
  - Успіх: loading-нотифікація «Формування документа» → «Документ готовий» (лінк відкривається), або orange «Документ недоступний»
  - Помилка: нотифікація стає червоною з message
  - ⚠ http→https переписування URL (toSecureUrl) — перевірити відкриття документів зі staging http-хостів
- [ ] **Підтвердження «Розблокувати рахунок»** _(action-modal)_ — дія Unlock в рядку (роль-залежна)
  - Поля: немає — лише confirm
  - Запит: `PATCH /api/v1/uk/sales/unlock?netId`
  - Валідація: —
  - Успіх: «Продаж розблоковано» + reload
  - Помилка: червона нотифікація з message в модалці; кнопки disabled/loading при isConfirming
- [ ] **Підтвердження «Розблокувати продаж для відвантаження» (IsAcceptedToPacking)** _(action-modal)_ — дія WillNotShip в рядку
  - Поля: немає — confirm
  - Запит: `GET /api/v1/uk/sales/get?netId — force-гідрація`
  - Запит: `POST /api/v1/uk/sales/update — повний sale з IsAcceptedToPacking=true (persistent mutation)`
  - Валідація: —
  - Успіх: «Збережено» + reload
  - Помилка: червона нотифікація
  - ⚠ POST повного об'єкта продажу: негідрований запис стирає Order.OrderPackages на сервері (bug #13 виправлено force-гідрацією) — регресійний кейс
- [ ] **Дровер аудиту (SaleAuditDetail)** _(action-modal)_ — дія «Історія редагувань»
  - Поля: підтвердження акту редагування
  - Запит: `GET /api/v1/uk/sales/get/shifted?netId — статистика`
  - Запит: `POST /api/v1/uk/protocol/act/invoice/set/edit/act/for/editing — підтвердження (onConfirmed → reload)`
  - Валідація: —
  - Успіх: закриття дроверу + reload
  - Помилка: auditError показується в дровері

### `/sales/ukraine/all/returns/new` — Повернення (список + створення з продажу)

- [ ] **Фільтр списку повернень** _(filter)_ — командний бар сторінки
  - Поля: Період з/по (date); Пошук (text); пагінація
  - Запит: `GET /api/v1/uk/sales/returns/all/filtered?from&to&value&limit&offset`
  - Валідація: —
  - Успіх: таблиця повернень оновлюється
  - Помилка: listError alert
- [ ] **Створення повернення з продажів (модал/дровер, 250мс автозавантаження)** _(create)_ — кнопка створення повернення → пошук продажів → редактор позиції → рев'ю
  - Поля: Клієнт (пошук, debounce 250); Організація (Select); Період продажів з/по; Пошук продажу/вендор-коду; Позиція: Кількість* (>0), Причина повернення* (status number), Склад повернення* (залежить від причини)
  - Запит: `GET /api/v1/uk/clients/all/filtered?filterSql=RegionCode.Value/Client.FullName/Client.USREOU&limit=20 — пошук клієнта`
  - Запит: `GET /api/v1/uk/organizations/all — довідник`
  - Запит: `GET /api/v1/uk/sales/all/returns/search?from&to&netId&organizationNetId&value — продажі для повернення`
  - Запит: `GET /api/v1/uk/sales/returns/vat?netId={orderItemNetId} — VAT-попередження позиції`
  - Запит: `GET /api/v1/uk/storages/all/returns/filtered?orderItemNetId&organizationNetId&status — склади повернення`
  - Запит: `POST /api/v1/uk/sales/returns/new — body {Client, SaleReturnItems[{OrderItem,Qty,SaleReturnItemStatus,Storage}]} — при «Створити»`
  - Валідація: validateDraft: qty>0, причина обрана, склад обраний; validateCreatePayload перед рев'ю та перед сабмітом; клієнт визначається з драфту — інакше «Неможливо визначити клієнта»
  - Успіх: зелена нотифікація «Повернення створено», очищення драфтів, закриття, reload списку
  - Помилка: reviewError/createError inline Alert з message; loading=isSaving
  - ⚠ VAT-попередження ковтається порожнім catch (setEditorVatWarning(null)) — користувач не дізнається про помилку перевірки ПДВ
  - ⚠ fallback організації для складів з фільтра, коли sale не має Organization.NetUid (bug #10) — регресійний кейс
- [ ] **Скасування повернення** _(action-modal)_ — дія «Скасувати» в рядку списку → confirm
  - Поля: confirm
  - Запит: `PUT /api/v1/uk/sales/returns/cancel?netId`
  - Валідація: —
  - Успіх: «Повернення скасовано», рядок оновлюється in-place
  - Помилка: listError alert з message
- [ ] **Експорт документа повернення** _(action-modal)_ — дія експорту в рядку
  - Поля: —
  - Запит: `GET /api/v1/uk/sales/returns/documents/export/get?netId`
  - Валідація: —
  - Успіх: модалка DownloadDocumentModal з Excel/PDF лінками
  - Помилка: listError alert

### `/sales/return/client` — Повернення від клієнта (пряме)

- [ ] **Дровер «Повернення від клієнта» (пряме, без продажу)** _(create)_ — кнопка «Створити повернення»
  - Поля: Організація* (Select; вантажить склади); Склад* (Select; disabled поки нема організації/причини; фільтр defective vs звичайний); Клієнт* (пошук); Договір* (Select, фільтрований по організації); Позиція: Товар* (пошук advanced, мін. 4 символи), Кількість* (>0, ≤ RemainingQty партії), Причина* (status), Партія приходу* (consignment)
  - Запит: `GET /api/v1/uk/organizations/all`
  - Запит: `GET /api/v1/uk/storages/get/all/filtered?organizationNetId&skipDefective`
  - Запит: `GET /api/v1/uk/clients/all/filtered?filterSql=…USREOU&limit=20 — пошук клієнта`
  - Запит: `GET /api/v1/uk/products/search/advanced?mode=5&sortMode=2&limit=10 — пошук товару (лише ≥4 символів)`
  - Запит: `GET /api/v1/uk/products/get?netId — деталі товару`
  - Запит: `GET /api/v1/uk/consignments/info/income/filtered?from&productNetId&to — партії приходу`
  - Запит: `POST /api/v1/uk/sales/returns/new — body {ClientAgreementId, ClientId, Products[{Batch,ProductId,ReasoForReturn,SpecificationQty}], StorageId} — сабміт форми`
  - Валідація: validateDraftItem (товар/кількість/причина/партія; qty ≤ залишку партії; заборона змішувати брак і звичайні причини) + validateReturnForm (клієнт/договір/позиції/склад відповідає причині); submit disabled без позицій, loading=isSaving
  - Успіх: зелена нотифікація «Повернення клієнта створено», очищення форми, закриття дроверу
  - Помилка: inline error (setError) з message сервера; попередження (warning) про ціну партії/змішані причини
  - ⚠ поле body називається ReasoForReturn (typo контракту) — не «виправляти» при тестуванні API
  - ⚠ закриття дроверу заблоковане лише під час isSaving; введені позиції зникають без підтвердження
- [ ] **Звіт по поверненнях клієнтів (ClientReturnsReportPanel)** _(action-modal)_ — кнопка «Сформувати звіт»
  - Поля: Клієнт (необов'язковий пошук); Тип звіту (0/1 radio); Період з/по; Лише мої клієнти (checkbox forMyClients)
  - Запит: `GET /api/v1/uk/clients/all/filtered — пошук клієнта (catch → порожньо)`
  - Запит: `GET /api/v1/uk/sales/returns/document/export?clientNetId&forMyClients&from&to&reportType — «Сформувати» (loading=isGenerating)`
  - Валідація: дат не перевіряє
  - Успіх: лінк(и) на документ
  - Помилка: generateError показується в панелі
  - ⚠ пошук клієнтів з порожнім catch

### `/sales/ukraine/debtors` — Дебітори

- [ ] **Фільтри дебіторів** _(filter)_ — app-filter-bar
  - Поля: Днів прострочення (Select days); Організація (Select); Тип договору (Select typeAgreement); Валюта (Select typeCurrency); Менеджер (Select userNetId); пагінація
  - Запит: `GET /api/v1/uk/debtors/all/filtered/by/client?days&limit&offset&organizationNetId&typeAgreement&typeCurrency&userNetId`
  - Запит: `GET /api/v1/uk/usermanagement/profiles/managers/sales — менеджери`
  - Запит: `GET /api/v1/uk/organizations/all — організації`
  - Валідація: —
  - Успіх: таблиця + тотали (TotalOverdueDebtorsValue тощо)
  - Помилка: error alert з message; довідники з порожнім catch (мовчки [])
  - ⚠ порожній catch на довідниках
- [ ] **Експорт звіту дебіторів** _(action-modal)_ — кнопка експорту (loading=isExporting)
  - Поля: використовує поточні фільтри
  - Запит: `GET /api/v1/uk/debtors/document/export?days&organizationNetId&typeAgreement&typeCurrency&userNetId`
  - Валідація: —
  - Успіх: DownloadDocumentModal з Anchor-лінками Excel/PDF (target=_blank)
  - Помилка: error alert
- [ ] **Дровер деталей боржника** _(inline)_ — клік по рядку
  - Поля: —
  - Запит: `GET /api/v1/uk/clients/get/debt/grouped?netId`
  - Запит: `GET /api/v1/uk/clients/get/debt/total?netId`
  - Валідація: —
  - Успіх: деталізація боргів
  - Помилка: catch на line ~555 — показує помилку в дровері

### `/sales/ukraine/interest` — Зацікавленість (передзамовлення)

- [ ] **Список передзамовлень (read-only)** _(filter)_ — кнопка Оновити + «Завантажити ще» (offset+30)
  - Поля: —
  - Запит: `GET /api/v1/uk/preorders/all/filtered?limit=30&offset`
  - Валідація: —
  - Успіх: таблиця; лінки на ProductCardModal
  - Помилка: НІЯКОГО: load має try/finally БЕЗ catch — помилка стає unhandled rejection, користувач бачить порожню таблицю без повідомлення
  - ⚠ відсутній catch у load — при 500 порожній екран без пояснення
- [ ] **Модалка «Зацікавленість» (створення передзамовлення; відкривається з майстра продажу, NewSaleProductsStep)** _(create)_ — з wizard кроку товарів (немає на самій цій сторінці)
  - Поля: Кількість* (NumberInput, ціле, ≥1); Коментар (Textarea)
  - Запит: `GET /api/v1/uk/preorders/new?productNetId&clientAgreementNetId&qty&comment — УВАГА: створення виконується GET-запитом з query-параметрами`
  - Валідація: qty ≥1, інакше Alert «Поле - обов'язкове»; кнопки disabled/loading при isCreating
  - Успіх: зелена нотифікація (Message сервера або «Збережено»), закриття
  - Помилка: червона «Не вдалося зберегти» (без деталей)
  - ⚠ create через GET — кешування/дедуплікація apiClient може ковтнути повторне створення з тими ж параметрами; коментар потрапляє в URL

### `/sales/ukraine/cart-reserve` — Резерви кошиків

- [ ] **Список резервів (read-only)** _(filter)_ — кнопка Оновити
  - Поля: —
  - Запит: `GET /api/v1/uk/sales/carts/all`
  - Валідація: —
  - Успіх: картки резервів
  - Помилка: catch → показ помилки (loadError)
  - ⚠ немає мутацій — суто перегляд

### `/sales/ukraine/client-product-movement` — Рух товарів по клієнту

- [ ] **Фільтри руху** _(filter)_ — app-filter-bar
  - Поля: Клієнт* (пошук з пагінацією по 20); Період з/по; Артикул (text); Організації (multi); пагінація
  - Запит: `GET /api/v1/uk/consignments/info/client/movement/filtered?article&clientNetId&from&to&limit&offset&organizationId`
  - Запит: `GET /api/v1/uk/organizations/all (порожній catch)`
  - Запит: `GET /api/v1/uk/clients/all/filtered?filterSql=…USREOU&limit=20&offset — пошук клієнта (порожній catch)`
  - Валідація: без клієнта список не вантажиться
  - Успіх: таблиця документів руху
  - Помилка: error alert з message
  - ⚠ обидва довідники з порожніми catch
- [ ] **Експорт руху в документ** _(action-modal)_ — кнопка експорту (loading=isExporting, disabled без рядків)
  - Поля: поточні фільтри
  - Запит: `GET /api/v1/uk/consignments/info/client/movement/document/export?ті самі параметри`
  - Валідація: —
  - Успіх: DownloadDocumentModal Excel/PDF
  - Помилка: error alert

### `/sales/ukraine/offers` — Оферти

- [ ] **Фільтр оферт за періодом** _(filter)_ — date-поля в барі + Оновити
  - Поля: Період з/по
  - Запит: `GET /api/v1/uk/sales/offers/all/filtered?from&to`
  - Валідація: —
  - Успіх: картки оферт
  - Помилка: error alert («Не вдалося завантажити оферти» — без message сервера)
  - ⚠ catch без деталей
- [ ] **Модалка «Нова оферта» (NewOfferModal)** _(create)_ — кнопка створення оферти
  - Поля: Клієнт* (пошук payers); Субклієнт (Select, за наявності); Договір* (Select, disabled поки нема клієнта); Товари: пошук по вендор-коду, кількість (перевірка наявності)
  - Запит: `GET /api/v1/uk/clients/payers/search/all?limit=50&value — пошук клієнта`
  - Запит: `GET /api/v1/uk/clients/all/clientsubclients/client?netId — субклієнти`
  - Запит: `GET /api/v1/uk/agreements/client/all?netId — договори`
  - Запит: `GET /api/v1/uk/products/search/vendorcode?limit=20 — товари`
  - Запит: `GET /api/v1/uk/products/reservations/current/carousel/agreement?clientAgreementNetId&productNetId — доступна к-сть (при додаванні товару)`
  - Запит: `POST /api/v1/uk/sales/offers/new — body ClientShoppingCart — «Створити»`
  - Валідація: create disabled без договору або без позицій; товар не додається, якщо AvailableQtyUk<=0 → «Немає товарів на складі»
  - Успіх: «Оферту успішно створено» + копіювання публічного лінка (при невдачі отримання лінка — червона нотифікація)
  - Помилка: «Не вдалося створити оферту» (без message сервера); всі lookup-catch порожні
  - ⚠ getOfferProductAvailableQtyUk(...).catch(()=>0): помилка перевірки наявності трактується як 0 і мовчки блокує додавання товару
  - ⚠ публічний лінк оферти хардкод http://37.48.104.145:12202/... — не https і не конфігурований
- [ ] **Дровер причин (OfferReasonDrawer)** _(edit)_ — дія «Причини» на картці оферти
  - Поля: причини по позиціях (Select/Textarea)
  - Запит: `POST /api/v1/uk/sales/offers/process — body оферти з причинами`
  - Валідація: —
  - Успіх: «Оферту успішно оновлено», закриття
  - Помилка: «Не вдалося зберегти причини»
- [ ] **Дії на картці: перезапуск/видалення/копіювання лінка** _(action-modal)_ — кнопки на OfferCard (+confirm-модалка для видалення)
  - Поля: confirm
  - Запит: `PATCH /api/v1/uk/sales/offers/update/validity?netId&validDays=2 — перезапуск (термін жорстко 2 дні)`
  - Запит: `POST /api/v1/uk/sales/offers/process — body {...offer, Deleted:true} — видалення`
  - Валідація: —
  - Успіх: зелені нотифікації «Оферту перезапущено»/«успішно видалено» + reload
  - Помилка: generic червоні нотифікації без message
  - ⚠ видалення реалізоване через process з Deleted=true — перевірити, що бек справді видаляє

### `/sales/ukraine/prediction` — Прогноз продажів

- [ ] **Селектори клієнта/товару (фільтри графіка)** _(filter)_ — два searchable Select
  - Поля: Клієнт (пошук); Товар (пошук)
  - Запит: `GET /api/v1/uk/clients/search/all/sales/?searchValue — пошук клієнтів (шлях із трейлінг-слешем)`
  - Запит: `GET /api/v1/uk/products/search/vendorcodeandsales?limit=20&searchValue — пошук товарів`
  - Запит: `GET /api/v1/uk/sales/prediction/get?clientNetId — прогноз по клієнту`
  - Запит: `GET /api/v1/uk/sales/prediction/get?productNetId — по товару`
  - Запит: `GET /api/v1/uk/sales/prediction/get?clientNetId&productNetId — комбінований`
  - Валідація: —
  - Успіх: 3 графіки (ByClient/ByProduct/ByClientAndProduct)
  - Помилка: кожен блок має власний loadError alert; abort-помилки ігноруються
  - ⚠ searchValue без мінімальної довжини — може сипати запити на кожен символ

### `/sales/charts` — Графіки продажів

- [ ] **Таб Top N-X: фільтр** _(filter)_ — pill-таби; поля from/to + typeTop Select
  - Поля: Період з/по; Тип топу (Select)
  - Запит: `GET /api/v1/uk/sales/get/managers/product/top?from&to&typeTop`
  - Валідація: —
  - Успіх: таблиця/чарт
  - Помилка: Alert «Не вдалося завантажити дані» (порожній catch, без message)
  - ⚠ catch без деталей помилки
- [ ] **Таб Продажі: по клієнту** _(filter)_ — Autocomplete клієнта + період + typePeriod
  - Поля: Клієнт (Autocomplete); Період з/по; Період групування (Select)
  - Запит: `GET /api/v1/uk/clients/payers/search/all?limit=50 — пошук`
  - Запит: `GET /api/v1/uk/sales/chart/by/client?from&netId&to&typePeriod`
  - Валідація: —
  - Успіх: стовпчиковий графік
  - Помилка: той самий generic alert
- [ ] **Таб Топ: по менеджерах** _(filter)_ — Select менеджера/організації + період
  - Поля: Менеджер (Select searchable); Організація (Select searchable); Період з/по
  - Запит: `GET /api/v1/uk/usermanagement/profiles/managers/sales`
  - Запит: `GET /api/v1/uk/organizations/all`
  - Запит: `GET /api/v1/uk/sales/get/info/by/managers?forMySales=false&from&to&netIdManager&netIdOrganization`
  - Валідація: —
  - Успіх: зведена таблиця з TotalByColumn
  - Помилка: generic alert; довідники з порожнім catch

### `/sales/cockpit` — Кокпіт менеджера

- [ ] **Фільтри задач + оновлення** _(filter)_ — CockpitToolbar/TaskFilters
  - Поля: status/urgency фільтри; asOfDate
  - Запит: `GET /api/v1/uk/sales/cockpit/inbox?limit&status`
  - Запит: `GET /api/v1/uk/sales/cockpit/count`
  - Запит: `GET /api/v1/uk/sales/cockpit/dashboard?asOfDate`
  - Запит: `GET /api/v1/uk/sales/cockpit/target?asOfDate`
  - Валідація: —
  - Успіх: список задач + дашборд-панелі; realtime reload (useCockpitRealtimeReload)
  - Помилка: loadError → alert
- [ ] **Модалка «Завершити завдання» (DoneModal)** _(action-modal)_ — кнопка Done на TaskCard
  - Поля: Продаж відбувся (Checkbox); Сума продажу (NumberInput ≥0, видима якщо sold)
  - Запит: `POST /api/v1/uk/sales/cockpit/tasks/status?taskKey — body {To:'done', Sold?, Amount?}`
  - Валідація: суму можна лишити порожньою; disabled=saving
  - Успіх: «Завдання виконано» + reload
  - Помилка: червона нотифікація з message
- [ ] **Модалка «Відкласти» (SnoozeModal)** _(action-modal)_ — кнопка Snooze
  - Поля: Нагадати* (datetime-local, дефолт заповнений)
  - Запит: `POST /api/v1/uk/sales/cockpit/tasks/status?taskKey — body {To:'snoozed', SnoozeUntil}`
  - Валідація: кнопка disabled без snoozeUntil; минулу дату НЕ валідує
  - Успіх: «Завдання відкладено»
  - Помилка: червона нотифікація
  - ⚠ можна відкласти в минуле — перевірити поведінку бека
- [ ] **Модалка нотатки (NoteModal)** _(action-modal)_ — кнопка Note
  - Поля: Текст* (Textarea)
  - Запит: `POST /api/v1/uk/sales/cockpit/tasks/notes?taskKey — body {Text}`
  - Валідація: disabled без trimmedText
  - Успіх: «Нотатку додано»
  - Помилка: червона нотифікація
- [ ] **Дії без модалки: в роботу / відхилити** _(action-modal)_ — кнопки на картці
  - Поля: —
  - Запит: `POST /api/v1/uk/sales/cockpit/tasks/status?taskKey — {To:'in_progress'} або {To:'dismissed'}`
  - Валідація: —
  - Успіх: нотифікації «взято в роботу»/«відхилено» + reload
  - Помилка: червоні нотифікації
  - ⚠ dismiss без підтвердження — випадковий клік втрачає задачу
- [ ] **Регенерація задач** _(action-modal)_ — кнопка в тулбарі (loading=isRegenerating)
  - Поля: asOfDate
  - Запит: `POST /api/v1/uk/sales/cockpit/generate?asOfDate — body {}`
  - Валідація: —
  - Успіх: «Завдання оновлено» + reload
  - Помилка: червона нотифікація
  - ⚠ потенційно важка операція — перевірити подвійний клік

### `/sales/cockpit/head` — Кокпіт керівника

- [ ] **Дашборд команди + ескалації** _(filter)_ — кнопка Оновити; asOfDate
  - Поля: asOfDate
  - Запит: `GET /api/v1/uk/sales/cockpit/head/team?asOfDate`
  - Запит: `GET /api/v1/uk/sales/cockpit/head/escalated?limit`
  - Запит: `GET /api/v1/uk/sales/cockpit/head/dashboard?asOfDate (HeadDashboardChartsPanel)`
  - Валідація: —
  - Успіх: таблиця команд/тоталів
  - Помилка: loadError alert
- [ ] **Дошка задач (HeadTaskBoard) — фільтри + регенерація** _(filter)_ — Select статусів/менеджера/терміновості
  - Поля: Статуси (Select); Менеджер (Select); Терміновість (Select); skip/limit
  - Запит: `GET /api/v1/uk/sales/cockpit/head/tasks?statuses&managerId&urgency&skip&limit`
  - Запит: `POST /api/v1/uk/sales/cockpit/generate — регенерація`
  - Валідація: —
  - Успіх: таблиця задач з ByStatus-лічильниками
  - Помилка: loadError/generateError

### `/sales/geography` — Географія продажів

- [ ] **Фільтри мапи (read-only)** _(filter)_ — селектори metric/period + Оновити
  - Поля: Метрика (sales/…); Період (period або months, дефолт 12); from/to (опційно)
  - Запит: `GET /api/v1/uk/sales/geography?metric&period|months&from&to`
  - Валідація: —
  - Успіх: bubble-мапа областей України
  - Помилка: loadError alert
  - ⚠ немає мутацій

### `/resales` — Перепродажі (список)

- [ ] **Фільтри списку перепродажів** _(filter)_ — бар: статус + період + пагінація
  - Поля: Статус (Select, number); Період з/по (date, валідація діапазону filterError); пагінація
  - Запит: `GET /api/v1/uk/resales/all?from&to&status&limit&offset&isFiltered`
  - Валідація: filterError блокує запит і чистить список
  - Успіх: таблиця; після повернення з /resales/new зі state.mutated — автоскидання фільтрів на діапазон, де видно новий драфт
  - Помилка: error alert з message
- [ ] **Видалення перепродажу** _(action-modal)_ — дія в рядку → confirm (deleteCandidate)
  - Поля: confirm
  - Запит: `POST /api/v1/uk/resales/remove?netId — body {}`
  - Валідація: —
  - Успіх: «Перепродаж видалено» + reload
  - Помилка: error alert
- [ ] **Експорт документа перепродажу** _(action-modal)_ — меню експорту в рядку (типи документів)
  - Поля: тип документа
  - Запит: `GET /api/v1/uk/resales/document/export?netId&type`
  - Валідація: —
  - Успіх: DownloadDocumentModal
  - Помилка: error alert
- [ ] **ТТН для перепродажу (локальний ConsignmentNoteSettingsDrawer)** _(edit)_ — дія ТТН в рядку
  - Поля: ті ж поля налаштувань ТТН
  - Запит: `GET /api/v1/uk/consignment/note/settings/all/get?forReSale=true`
  - Запит: `POST /api/v1/uk/consignment/note/settings/add?forReSale=true`
  - Запит: `POST /api/v1/uk/consignment/note/settings/update?forReSale=true`
  - Запит: `POST /api/v1/uk/consignment/note/settings/remove?forReSale=true&netId`
  - Запит: `POST /api/v1/uk/consignment/note/settings/print/document?forReSale=true&netId`
  - Валідація: аналогічна sales-ukraine версії
  - Успіх: нотифікації збереження/видалення; друк відкриває документ
  - Помилка: catch-нотифікації
  - ⚠ дублікат компонента (копія в ResalesPage.tsx:3081) — поведінка може розійтися з sales-ukraine версією

### `/resales/new` — Новий перепродаж (підбір наявності)

- [ ] **Фільтр наявності для перепродажу** _(filter)_ — форма фільтрів (сума, націнка, похибка, групи, спец-коди, склади, пошук, період)
  - Поля: Сума (amount); Націнка % (extraChargePercent); Похибка (infelicity); Групи товарів (multi); Специфікаційні коди (multi); Склади (multi); Пошук (text); Період з/по (datetime, дефолт -365 днів)
  - Запит: `GET /api/v1/uk/resales/availabilities/filter/options (+фолбек GET /resales/availabilities/specification/codes)`
  - Запит: `POST /api/v1/uk/resales/availabilities/all/filtered — body payload фільтра — завантаження таблиці`
  - Валідація: dateRangeError блокує; при завантаженні dropdown'и disabled
  - Успіх: таблиця наявності з тоталами (TotalQty/TotalValueWithVat)
  - Помилка: error alert; warning з бекенду (ResaleBackendWarning з Products)
- [ ] **Обробка вибраних позицій → створення перепродажу** _(create)_ — чекбокси рядків → «Обробити» (confirm) → CreateResaleSheet (клієнт/договір) → «Створити»
  - Поля: Вибрані позиції (усі з одного складу); Клієнт* (пошук forReSale); Договір* (Select); коригування к-сті/цін у sheet (onRecalculate)
  - Запит: `POST /api/v1/uk/resales/availability/list/update — body вибраних item models — підготовка`
  - Запит: `GET /api/v1/uk/clients/all/filtered?active=true&forReSale=true&limit=20 — пошук клієнта`
  - Запит: `GET /api/v1/uk/agreements/client/all?netId&includeDebts=false — договори`
  - Запит: `POST /api/v1/uk/resales/availability/list/update — перерахунок у sheet`
  - Запит: `POST /api/v1/uk/resales/add — body ResaleCreatePayload — фінальне створення`
  - Валідація: вибір лише з одного складу («Оберіть товари з одного складу»); без вибраних — warning; backend-warning (result.warning) показується замість створення
  - Успіх: «Перепродаж створено» → navigate('/resales', state.mutated) зі скиданням фільтрів списку
  - Помилка: error alert з message; loading=isProcessing
  - ⚠ дві послідовні POST-операції (update list → add) — обрив між ними лишає підготовлений стан лише на клієнті
- [ ] **Автоматичний підбір** _(action-modal)_ — кнопка «Створити автоматично» (потрібен обраний склад generateStorageNetId)
  - Поля: Склад для генерації* (Select); параметри поточного фільтра (Amount, ExtraChargePercent, включені групи/коди/склади)
  - Запит: `POST /api/v1/uk/resales/generate/automatically — body payload+SelectedStorageNetId`
  - Валідація: без складу — warning «Оберіть склад для автоматичного створення»; чекає завантаження наявності
  - Успіх: відкриває той самий CreateResaleSheet з підібраними позиціями
  - Помилка: error alert
- [ ] **Експорт підбору** _(action-modal)_ — кнопка експорту (loading=isExporting)
  - Поля: поточний payload фільтра
  - Запит: `POST /api/v1/uk/resales/document/resale — body payload`
  - Валідація: —
  - Успіх: DownloadDocumentModal
  - Помилка: error alert

### `/resales/:id` — Перепродаж (деталі/редагування)

- [ ] **Inline-редагування позицій + автоперерахунок** _(inline)_ — редагування QtyToReSale/SalePrice/Amount у клітинках таблиці (заблоковано при isCompleted)
  - Поля: К-сть до перепродажу (number); Ціна продажу (number); Сума (number); Коментар, Договір (шапка)
  - Запит: `POST /api/v1/uk/resales/updated/get?netId — body UpdatedResaleModel — завантаження і КОЖЕН дебаунс-перерахунок після зміни клітинки`
  - Валідація: числові поля через toNumber; race захищений requestId (detailRequestRef)
  - Успіх: рядки/тотали оновлюються відповіддю сервера
  - Помилка: error alert «Не вдалося перерахувати позиції»; warning з бекенду
  - ⚠ перерахунок шле весь model POST'ом — перевірити швидке редагування кількох клітинок підряд (дебаунс + скасування)
- [ ] **Збереження перепродажу** _(edit)_ — кнопка «Зберегти» (loading=isSaving)
  - Поля: весь model
  - Запит: `POST /api/v1/uk/resales/update — body UpdatedResaleModel`
  - Валідація: —
  - Успіх: «Перепродаж збережено», модель оновлюється
  - Помилка: error alert; warning-відповідь показується як warning
- [ ] **Перевести в інвойс** _(action-modal)_ — кнопка (недоступна якщо вже інвойс/завершено/нема договору)
  - Поля: —
  - Запит: `POST /api/v1/uk/resales/update — спершу зберігає`
  - Запит: `POST /api/v1/uk/resales/change/to/invoice?netId — body {}`
  - Валідація: guard-и на статуси; warning від update зупиняє конверсію
  - Успіх: модель стає інвойсом (ChangedToInvoice)
  - Помилка: error alert «Не вдалося перевести у інвойс» (warning від complete кидається як Error)
  - ⚠ двокроковість: update пройшов, конверсія впала — стан частково змінений
- [ ] **Завершити інвойс** _(action-modal)_ — кнопка (лише для інвойса)
  - Поля: —
  - Запит: `POST /api/v1/uk/resales/update — спершу зберігає`
  - Запит: `POST /api/v1/uk/resales/complete?netId — body {}`
  - Валідація: guard-и статусів
  - Успіх: модель стає завершеною, редагування блокується
  - Помилка: error alert «Не вдалося завершити інвойс»
  - ⚠ та сама двокроковість update→complete
- [ ] **Експорт документів + ТТН** _(action-modal)_ — кнопки експорту / дровер ТТН
  - Поля: тип документа
  - Запит: `GET /api/v1/uk/resales/document/export?netId&type`
  - Запит: `consignment/note/settings/* з forReSale=true (як на списку)`
  - Валідація: —
  - Успіх: DownloadDocumentModal / друк ТТН
  - Помилка: error alert / нотифікації

### `/sales-online-shop` — Продажі інтернет-магазину

- [ ] **Фільтри списку e-commerce продажів** _(filter)_ — app-filter-bar (аналог /sales/ukraine/all, без клієнта/організацій)
  - Поля: Період з/по; Статус (Select); Тип (Select); Пошук (text); пагінація
  - Запит: `GET /api/v1/uk/sales/all/filtered?fastEcommerce=true&forEcommerce=true&from&to&limit&offset&status&type&value`
  - Валідація: —
  - Успіх: грид з realtime-оновленням
  - Помилка: error alert
- [ ] **Редактор продажу (SaleEditorDrawer з sales-ukraine)** _(edit)_ — дія редагування в рядку
  - Поля: Клієнт/договір (пошук + switch); дані доставки + файл; конвертація VAT з платіжним документом; об'єднання продажів (MergedSalesDrawer)
  - Запит: `GET /api/v1/uk/sales/get?netId`
  - Запит: `GET /api/v1/uk/agreements/client/all?netId`
  - Запит: `GET /api/v1/uk/clients/get/debt/total?netId`
  - Запит: `GET /api/v1/uk/retail/clients/paid/amount?saleId — статус оплати retail`
  - Запит: `GET /api/v1/uk/products/search/vendorcode — пошук товару`
  - Запит: `GET /api/v1/uk/clients/all/filtered — пошук клієнта`
  - Запит: `PATCH /api/v1/uk/sales/switch?clientAgreementNetId&saleNetId — зміна договору/кошика`
  - Запит: `POST /api/v1/uk/sales/update/file — збереження з файлом`
  - Запит: `POST /api/v1/uk/sales/update/get/payment/document — конвертація VAT + платіжний документ`
  - Запит: `GET /api/v1/uk/sales/get/merged?netId, GET /sales/get/current/unmerged?netId, POST /api/v1/uk/sales/update/merged — об'єднання`
  - Валідація: кнопки loading/disabled на isSaving; persistent mutations з reconcile
  - Успіх: нотифікації збереження; закриття → reload
  - Помилка: червоні нотифікації з message
  - ⚠ великий компонент (1523 рядки) — тестувати merge-потік окремо: подвійне об'єднання, обрив під час update/merged
- [ ] **Знижка / деталі доставки / ТТН / документи / аудит** _(action-modal)_ — ті самі компоненти sales-ukraine (SaleDiscountModal, SaleDetailsDrawer, ConsignmentNoteSettingsDrawer, SaleDocumentsMenu, SaleAuditDetail)
  - Поля: див. /sales/ukraine/all
  - Запит: `POST /api/v1/uk/sales/discount/update`
  - Запит: `POST /api/v1/uk/sales/update/file`
  - Запит: `consignment/note/settings/* (forReSale=false)`
  - Запит: `GET /api/v1/uk/sales/get/last/document та ін.`
  - Запит: `GET /api/v1/uk/sales/get/shifted?netId`
  - Валідація: як на /sales/ukraine/all
  - Успіх: як на /sales/ukraine/all
  - Помилка: як на /sales/ukraine/all
- [ ] **Confirm: розблокувати / не буде відвантажено** _(action-modal)_ — дії в рядку
  - Поля: confirm
  - Запит: `PATCH /api/v1/uk/sales/unlock?netId`
  - Запит: `GET /api/v1/uk/sales/get?netId → POST /api/v1/uk/sales/update (IsAcceptedToPacking=true)`
  - Валідація: —
  - Успіх: зелені нотифікації + reload
  - Помилка: runConfirm має catch БЕЗ параметра — завжди generic «Не вдалося виконати дію», message сервера втрачається (на відміну від sales-ukraine)
  - ⚠ втрата серверного message у confirm-діях

### `/incomplete-sales-online-shop` — Незавершені продажі інтернет-магазину

- [ ] **Фільтри незавершених продажів** _(filter)_ — бар: номер, період, статус прийняття
  - Поля: Номер (text); Період з/по (to доводиться до T23:59:59); isAccepted (перемикач)
  - Запит: `GET /api/v1/uk/sales/misplaced/get/all?number&from&to&isAccepted`
  - Валідація: —
  - Успіх: DataTable; дровер деталей з IncompleteSaleItemsList
  - Помилка: loadError alert
- [ ] **Закріпити за собою / Виконано (confirm-модалка)** _(action-modal)_ — кнопки в рядку/дровері → AppModal confirm (loading=isConfirming)
  - Поля: confirm; для «закріпити» — поточний користувач
  - Запит: `POST /api/v1/uk/sales/misplaced/update — body всього IncompleteSale з MisplacedSaleStatus=1 (закріплено, +User/UserId) або 2 (виконано)`
  - Валідація: без user.Id — червона нотифікація «Користувача не визначено»; кнопки disabled при isUpdating
  - Успіх: «Продаж закріплено»/«Продаж виконано», рядок замінюється відповіддю сервера (або локальним nextSale, якщо відповідь порожня)
  - Помилка: червона нотифікація з message
  - ⚠ якщо сервер повертає порожній список — рядок оновлюється оптимістично локальними даними (можлива розбіжність зі станом сервера)

### `/reports/sale` — Звіт продажів (перегляд XLSX)

- [ ] **Завантаження та фільтрація XLSX (повністю клієнтська)** _(import)_ — кнопка Upload (label+input file) → парсинг read-excel-file у браузері
  - Поля: Файл .xlsx; Пошук (text); Період з/по (date, фільтр рядків)
  - Запит: `ЖОДНИХ запитів на сервер — парсинг, CSV-експорт (downloadTextFile) і друк (window.print) локальні`
  - Валідація: parse-помилка → error alert
  - Успіх: таблиця аркушів + тотали; експорт CSV disabled без активного аркуша
  - Помилка: Alert з повідомленням парсера
  - ⚠ немає серверної взаємодії — тестування обмежується файлами (битий xlsx, великі файли)

### `/reports/stocks` — Звіт по залишках (конструктор)

- [ ] **Конструктор звіту** _(create)_ — форма: період + показники + групування + фільтри-selection → кнопка «Сформувати» (type=submit)
  - Поля: З/По (date)*; Показники (чекбокси measurements; мінімум 1); Групування рядків/колонок (MultiSelect); Selections: чекбокс + поле (Select) + умова (Select) + значення (динамічний лукап за типом поля)
  - Запит: `POST /api/v1/uk/report/get/all/filtered — body {from,to,sorted{Col,Row,Measurements},selections} — формування`
  - Запит: `Лукапи значень фільтрів: GET /api/v1/uk/organizations/all; /clients/types/all; /regions/all/codes; /pricings/all; /products/groups/filtered/get?value; /products/groups/get/top; /products/search/advanced (mode=5); /clients/all/filtered; /agreements/client/all?netId; /usermanagement/profiles/search/lookup; /sales/all/filtered/reports; /sales/returns/all/filtered`
  - Валідація: canSubmit = валідний діапазон дат (getFilterError) І ≥1 показник; кнопка disabled інакше, loading=isLoading
  - Успіх: таблиця результату + якщо є DocumentURL/PdfDocumentURL — модалка завантаження; CSV-експорт прев'ю локально
  - Помилка: error alert з message
  - ⚠ шаблони звітів зберігаються ТІЛЬКИ в localStorage (STORAGE_KEY) — не синхронізуються між браузерами; видалення шаблону без підтвердження
  - ⚠ selection без обраного значення тихо відфільтровується з body (IsChecked && SelectedField.Name)

## Модуль ОБЛІК — 34 сторінок, 72 форм

> Шляхи запитів: apiRequest формує URL як /api/v1/{lang}{path} (lang з VITE_API_LANGUAGE, дефолт 'uk'); у таблиці вище {lang} — це мовний сегмент, напр. POST /api/v1/uk/payments/orders/outcome/new
> ГОЛОВНА ЗОНА РИЗИКУ: коміт 6f04db21 'fix(cashflows): bugs 88, 89, 90, 91 — payments create paths' — регресійно тестувати УСІ create-шляхи платежів: POST /payments/orders/outcome/new (4 режими outgoing + оплата накладної), POST /payments/orders/outcome/new/supplies (наявні платежі), POST /payments/orders/income/new?auto= (4 форми income), POST /payments/orders/outcome/update (авансовий звіт)
> Загальний UX-патерн: усі форми — ручна покрокова валідація (без mantine useForm.validate), помилки в Alert усередині форми/модалки, isSaving блокує кнопки (захист від подвійного сабміту), успіх = зелена notification + navigate/reload
> Системні помилки lookup-запитів (пошук статей, користувачів, договорів) часто ковтаються через .catch(() => undefined) або .catch(() => fallback) — при відмові бекенду автокомпліти просто порожні без повідомлення
> Модалки скасування ордерів (income/outgoing) показують помилку у page-level Alert, а не в модалці — модалка лишається відкритою без видимої причини
> CurrencyConvertorFormPage — нуль клієнтської валідації (можна створити порожнього трейдера); saveNewRate у курсах теж без валідації значень
> PaymentShopDetailDrawer (додавання платежу магазину): невалідний сабміт — мовчазний no-op без повідомлення
> DocumentOutcomePaymentModal (src/features/document-outcome-payment) — створення видаткових з митних документів: POST /api/v1/{lang}/payments/orders/outcome/new/taxfree?taxFreeNetId= та POST /api/v1/{lang}/payments/orders/outcome/new/sad?sadNetId=; викликається зі сторінок SAD/Tax-Free (митний модуль), але це теж payments-create-зона підвищеного ризику
> Видалення банку та курсів валют — 'м'яке' через POST update з Deleted=true, без DELETE-запиту
> GET-фільтри з date-range мають клієнтську перевірку діапазону (getDateRangeError): при некоректному діапазоні таблиця мовчки очищається без запиту
> Route /accounting/income-cashflows/new редіректить на /new/conversion?type=0; /accounting/outgoing-cashflow/new/payment-tasks редіректить на сторінку наявних платежів

### `/accounting/consumable-product` — Розхідні товари (категорії/товари)

- [ ] **Пошук категорій/товарів** _(filter)_ — Поле «Пошук» (Категорія або товар) + кнопки Скинути/Оновити
  - Поля: Пошук (text, debounce)
  - Запит: `GET /api/v1/{lang}/consumables/categories/all — початкове завантаження/оновлення`
  - Запит: `GET /api/v1/{lang}/consumables/categories/search?value= — при вводі`
  - Успіх: Оновлення дерева категорій та таблиці товарів
  - Помилка: Alert з текстом помилки на сторінці
- [ ] **Категорія (створення/редагування)** _(action-modal)_ — Кнопка + біля категорій / олівець на категорії
  - Поля: Назва* (text, required); Послуги (checkbox IsService)
  - Запит: `POST /api/v1/{lang}/consumables/categories/new — створення`
  - Запит: `POST /api/v1/{lang}/consumables/categories/update — редагування`
  - Валідація: Порожня назва → помилка «Вкажіть назву категорії», запит не йде
  - Успіх: Зелена notification, модалка закривається, перезавантаження списку
  - Помилка: setError → Alert; модалка лишається відкритою
- [ ] **Товар (створення/редагування)** _(action-modal)_ — Кнопка додати товар у категорії / олівець на рядку
  - Поля: Назва* (text, required); Артикул (text); Одиниця виміру (autocomplete)
  - Запит: `POST /api/v1/{lang}/consumables/products/new`
  - Запит: `POST /api/v1/{lang}/consumables/products/update`
  - Запит: `GET /api/v1/{lang}/measureunits/search?value= — lookup одиниць виміру`
  - Валідація: Порожня назва → «Вкажіть назву товару»
  - Успіх: Зелена notification + reload
  - Помилка: Alert з message помилки
- [ ] **Видалення категорії/товару** _(action-modal)_ — Іконка смітника → підтвердження
  - Запит: `DELETE /api/v1/{lang}/consumables/categories/delete?netId=`
  - Запит: `DELETE /api/v1/{lang}/consumables/products/delete?netId=`
  - Валідація: Якщо запис без NetUid → «Запис не має NetUid для видалення»
  - Успіх: Notification + reload
  - Помилка: Alert
  - ⚠ Перевірити 409/4xx коли категорія містить товари — сервер може відмовити, UI покаже лише message

### `/accounting/advanced-reports` — Авансові звіти

- [ ] **Фільтри авансових звітів** _(filter)_ — Панель фільтрів: дати від/до, валюта, стаття руху, рахунок, пошук
  - Поля: from/to (date); Валюта (select); Стаття руху (select); Рахунок (select); Пошук (text)
  - Запит: `GET /api/v1/{lang}/payments/orders/outcome/all/underreport?from&to&limit&offset&currencyNetId&paymentMovementNetId&registerNetId&value`
  - Запит: `GET /api/v1/{lang}/currencies/all, GET /api/v1/{lang}/payments/movements/all, GET /api/v1/{lang}/payments/registers/search?value= — довідники`
  - Успіх: Таблиця + суми позитивної/негативної різниці
  - Помилка: Alert «Не вдалося завантажити...»
  - ⚠ Детальні drawer-и (Авансовий звіт, Структура документів) read-only; редагування — перехід на /accounting/outgoing-cashflow/:id/advanced-report/view

### `/accounting/consumable-services` — Підзвітні витрати (послуги)

- [ ] **Фільтр + пошук** _(filter)_ — Дати від/до + пошук
  - Поля: from/to (date); Пошук (text)
  - Запит: `GET /api/v1/{lang}/consumables/orders/all/services?from&to&limit&offset&value`
  - Успіх: Таблиця витрат
  - Помилка: Alert
- [ ] **Action-модалка рядка** _(action-modal)_ — Клік по рядку
  - Запит: `Немає прямих запитів — навігація: Деталі (drawer), Відкрити накладну (/accounting/consumable-orders/edit/:id), Оплатити (/accounting/consumable-orders/pay/:id, тільки якщо не paid)`
  - Успіх: Навігація
  - Помилка: -

### `/accounting/consumable-orders` — Прибуткові накладні (розхідники)

- [ ] **Фільтр + пошук накладних** _(filter)_ — Дати від/до, пошук
  - Поля: from/to (date); Пошук (text)
  - Запит: `GET /api/v1/{lang}/consumables/orders/all?from&to&limit&offset`
  - Запит: `GET /api/v1/{lang}/consumables/orders/search?value&from&to&limit&offset — при пошуку`
  - Успіх: Таблиця, paginator
  - Помилка: Alert
- [ ] **Action-модалка накладної** _(action-modal)_ — Клік по рядку
  - Запит: `Навігація: Деталі (drawer), Редагувати (/edit/:id), Оплатити (/pay/:id — кнопка прихована якщо isPayed)`
  - Успіх: Навігація / drawer
  - Помилка: -

### `/accounting/consumable-orders/new | /edit/:id` — Прибуткова накладна — створення/редагування

- [ ] **Форма накладної** _(create)_ — Кнопка створення на списку / Редагувати з модалки
  - Поля: Постачальник послуг* (autocomplete); Договір* (select, залежить від постачальника); Організація (з договору); Номер накладної (text); Дата входу* (date); Час* (time); Склад* (autocomplete); Коментар (text); Платіжний протокол: Новий (toggle), Сплатити до* (date якщо увімкнено), Відповідальний* (select фін.директорів), Коментар до платежу; Позиції* (грід: Назва товару/послуги, Артикул, Категорія, Стаття витрат, Кількість>0, Ціна за одиницю, ПДВ); Додати документи (FileInput multiple)
  - Запит: `POST /api/v1/{lang}/consumables/orders/upload/new — multipart (order JSON + documents) при створенні`
  - Запит: `POST /api/v1/{lang}/consumables/orders/upload/update — при редагуванні`
  - Запит: `POST /api/v1/{lang}/consumables/orders/calculate — перерахунок сум при зміні позицій`
  - Запит: `GET /api/v1/{lang}/consumables/orders/get?netId= — завантаження в edit`
  - Запит: `GET /api/v1/{lang}/supplies/organizations/all/search?value&limit=20&offset=0`
  - Запит: `GET /api/v1/{lang}/consumables/storages/search?value=`
  - Запит: `GET /api/v1/{lang}/consumables/categories/search?value=`
  - Запит: `GET /api/v1/{lang}/consumables/products/search/vendorcode?value=`
  - Запит: `GET /api/v1/{lang}/payments/costs/movements/all/search?value=`
  - Запит: `GET /api/v1/{lang}/organizations/all`
  - Запит: `GET /api/v1/{lang}/usermanagement/profiles/all/by?types=7 — фін.директори`
  - Валідація: validateOrderPayload: постачальник, договір з організацією, склад, ≥1 не видалена позиція, відповідальний якщо є платіжний протокол; validateFormDates: дата входу/час/дата оплати; validateItem на кожну позицію
  - Успіх: Зелена notification («збережено»), navigate назад на список
  - Помилка: setError → Alert над формою; кнопка Save disabled без прав (canSave)
  - ⚠ ПІДВИЩЕНИЙ РИЗИК: пов'язано з платіжними протоколами (SupplyPaymentTask) — зона недавніх фіксів cashflows
  - ⚠ calculate виконується асинхронно при змінах — перевірити гонки при швидкому редагуванні позицій і сабміті до завершення calculate

### `/accounting/consumable-orders/pay/:id` — Оплата прибуткової накладної

- [ ] **Форма оплати накладної** _(create)_ — «Оплатити» з action-модалки списку накладних або підзвітних витрат
  - Поля: Організація* (select); Каса/рахунок* (select); Валюта* (select currency register); Стаття руху коштів* (autocomplete + кнопка створити нову); Сума* (>0, ≤ залишку до оплати); Дата/час; Коментар
  - Запит: `GET /api/v1/{lang}/consumables/orders/get?netId=`
  - Запит: `POST /api/v1/{lang}/consumables/orders/calculate — розрахунок залишку`
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new — створення оплати (сабміт)`
  - Запит: `POST /api/v1/{lang}/payments/movements/new — інлайн-створення статті руху`
  - Запит: `GET /api/v1/{lang}/organizations/all, /payments/registers/search, /payments/movements/all, /payments/movements/all/search`
  - Валідація: validatePaymentForm: є позиції, є постачальник у накладній, організація/рахунок/валюта/стаття, сума>0, сума ≤ залишку (MONEY_EPSILON), блок якщо IsPayed («Накладна вже оплачена»)
  - Успіх: Зелена notification «Оплату накладної створено» + navigate назад
  - Помилка: Alert; кнопка з loading=isSaving (захист від подвійного сабміту)
  - ⚠ ПІДВИЩЕНИЙ РИЗИК: create-path платежів — зона фіксів багів 88–91; регресійно перевірити повну/часткову оплату, повторну оплату вже оплаченої накладної, оплату в іншій валюті

### `/accounting/outgoing-cashflow` — Видаткові ордери

- [ ] **Фільтри видаткових ордерів** _(filter)_ — Панель: дати, валюта, стаття руху, рахунок, мультивибір організацій, пошук (debounce)
  - Поля: from/to (date); Валюта (select); Стаття руху (select); Рахунок (select); Організації (multiselect, всі обрані за замовчуванням); Пошук (text)
  - Запит: `GET /api/v1/{lang}/payments/orders/outcome/all?from&to&limit&offset&currencyNetId&paymentMovementNetId&registerNetId&organizationIds&value`
  - Запит: `GET /api/v1/{lang}/payments/orders/outcome/get?netId= — фокус на ордері (deep-link/деталі)`
  - Запит: `Довідники: /currencies/all, /payments/registers/search, /payments/movements/all, /organizations/all`
  - Успіх: Таблиця + суми різниць, requestRef захищає від застарілих відповідей
  - Помилка: Alert
  - ⚠ Помилка діапазону дат (filterError) мовчки очищає таблицю без запиту — QA має перевірити повідомлення про некоректний діапазон
- [ ] **Скасування видаткового ордера** _(action-modal)_ — Дія «Скасувати» на рядку → модалка підтвердження
  - Запит: `PUT /api/v1/{lang}/payments/orders/outcome/cancel?netId=`
  - Валідація: Кнопка disabled/loading під час isCanceling; закриття модалки заблоковане під час збереження
  - Успіх: Модалка закривається, список перезавантажується (без notification)
  - Помилка: Помилка показується у ПАГЕ-alert (не в модалці), модалка ЛИШАЄТЬСЯ відкритою
  - ⚠ Помилка скасування рендериться поза модалкою — користувач у модалці може її не побачити
  - ⚠ Немає success-notification при скасуванні

### `/accounting/outgoing-cashflow/new (+ /simple, /supplier, /client-return, /group)` — Створення видаткового ордера (4 режими)

- [ ] **Selector режиму** _(action-modal)_ — /new відкриває drawer з вибором режиму; /new/payment-tasks редіректить на наявні платежі
  - Запит: `Немає — навігація всередині drawer`
  - Успіх: Перехід до відповідної форми
  - Помилка: -
- [ ] **Видатковий на колегу / під звіт (simple, OutgoingCashOrderForm)** _(create)_ — /new/simple
  - Поля: Організація* (select, авто-підбір головного рахунку); Грошовий рахунок* (select, фільтр по організації); Валюта* (currency register, показ залишку); Стаття грошових витрат* (autocomplete + інлайн-створення); Під звіт (checkbox, default true); Відповідальний/колега* якщо під звіт (autocomplete users); Сума* (>0); Дата/час; Номер рахунку-фактури (opt); Коментар, Призначення платежу; IsAccounting/IsManagementAccounting (checkbox)
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new — сабміт (OperationType=TransferToColleague)`
  - Запит: `POST /api/v1/{lang}/payments/movements/new — інлайн-створення статті`
  - Запит: `GET /organizations/all, /payments/registers/search, /payments/movements/all(+/search), /usermanagement/profiles/search`
  - Валідація: validateForm: організація, рахунок, валюта, стаття, колега (якщо під звіт), сума>0. Повідомлення дуже короткі («Сума», «Валюта»)
  - Успіх: Notification «Створення нового видаткового ордера» + navigate на список
  - Помилка: setError → Alert у формі; кнопка loading=isSaving
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91)
  - ⚠ Пошук статей/користувачів .catch(() => undefined) — помилки lookup ковтаються мовчки
  - ⚠ Текст success-notification виглядає як заголовок, а не підтвердження
- [ ] **Поповнити баланс постачальника послуг (supplier, OutgoingOrganizationPaymentForm)** _(create)_ — /new/supplier
  - Поля: Організація*; Рахунок*; Валюта*; Контрагент (supply organization)* (autocomplete); Договір* (має належати вибраній організації); Сума* (>0); Курс (opt); Дата/час; Коментар; Неоплачені накладні постачальника (picker, опційно — рознесення оплати)
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new — сабміт з SupplyOrganizationAgreement + OutcomePaymentOrderConsumablesOrders`
  - Запит: `GET /api/v1/{lang}/consumables/orders/all/unpaid?organizationNetId= — неоплачені накладні`
  - Запит: `GET /api/v1/{lang}/supplies/organizations/agreements/by?id=`
  - Запит: `POST /api/v1/{lang}/payments/movements/new — інлайн-створення статті`
  - Валідація: організація/рахунок/валюта/контрагент/договір/договір належить організації/сума>0/стаття
  - Успіх: Notification + navigate на список
  - Помилка: Alert у формі
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91): рознесення суми по неоплачених накладних (buildConsumableOrderPaymentLinks) — перевірити часткові оплати
  - ⚠ getIncomeCashflowSupplyOrganizationAgreements(...).catch — fallback мовчки
- [ ] **Повернення клієнту (client-return, OutgoingClientReturnForm)** _(create)_ — /new/client-return
  - Поля: Організація*; Рахунок*; Валюта*; Клієнт* (autocomplete); Договір клієнта*; Сума* (>0); Курс (opt); Дата/час; Коментар
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new — з ClientAgreement`
  - Запит: `GET /api/v1/{lang}/agreements/client/all?netId= (catch → fallback на client.ClientAgreements)`
  - Запит: `GET /api/v1/{lang}/clients/all/filtered — пошук клієнтів`
  - Валідація: організація/рахунок/валюта/клієнт/договір/сума>0/стаття
  - Успіх: Notification + navigate
  - Помилка: Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91)
- [ ] **Груповий видатковий (group, OutgoingPaymentGroupForm)** _(create)_ — /new/group?operationType=&registerType= (оплата постачальнику / повернення покупцю / інші видатки з/без контрагентів; каса або банк)
  - Поля: Сума* (>0); Стаття руху*; Отримувач* (постачальник або клієнт, окрім режиму «інші видатки»); Договір* (окрім «інші видатки»); Організація*; Каса/рахунок*; Валюта*; Дата/час, коментар; Неоплачені накладні (для постачальника)
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new`
  - Запит: `GET /api/v1/{lang}/consumables/orders/all/unpaid?organizationNetId=`
  - Запит: `GET /api/v1/{lang}/agreements/client/all?netId=, GET /api/v1/{lang}/supplies/organizations/agreements/by?id=`
  - Запит: `GET /api/v1/{lang}/supplies/organizations/all/search | /clients/all/filtered — пошук контрагентів`
  - Запит: `POST /api/v1/{lang}/payments/movements/new`
  - Валідація: validateForm: сума>0, стаття, отримувач+договір (умовно від operationType), організація, рахунок, валюта
  - Успіх: Notification + navigate
  - Помилка: Alert «Не вдалося створити видатковий ордер»
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91): найскладніша форма — 4 operationType × 2 registerType; перевірити всі комбінації, особливо «інші видатки» без контрагента

### `/accounting/outgoing-cashflow/:id/advanced-report/view` — Авансовий звіт — перегляд/закриття

- [ ] **Редагування/закриття авансового звіту** _(edit)_ — З advanced-reports або списку видаткових
  - Поля: Гріди товарів (накладні розхідників) і пального (заправки авто); Кнопки: Зберегти (auto=false/true), Закрити різницю
  - Запит: `GET /api/v1/{lang}/payments/orders/outcome/get?netId=`
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/calculate — перерахунок після кожної зміни`
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/update?auto= — збереження без нових документів`
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/upload/update?auto= — multipart якщо додані документи`
  - Запит: `POST /api/v1/{lang}/consumables/orders/calculate — модалка накладної`
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/fuelings/calculate — модалка пального`
  - Запит: `GET /api/v1/{lang}/supplies/organizations/all/search — пошук постачальника`
  - Валідація: Мінімум 1 рядок (інакше червона notification «Добавьте хоча б 1 товар» — русизм у тексті); модалки мають власні validateOrderPayload/validateFormDates/validateItem/validateFueling; confirm-close при незбережених змінах
  - Успіх: Зелена notification «Оновлення видаткового ордера» + navigate назад
  - Помилка: error у view-state → Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК: update-шлях платежів; IsPayed примусово ставиться true всім накладним при збереженні
  - ⚠ Часті calculate-запити при редагуванні — перевірити гонки/застарілі суми
  - ⚠ Локальні NetUid ('local-') вирізаються перед сабмітом — перевірити збереження нових рядків
  - ⚠ Текст помилки з русизмом «Добавьте»

### `/accounting/storages` — Склади розхідників + списання

- [ ] **Список складів + видалення** _(action-modal)_ — Список GET при завантаженні; смітник → модалка підтвердження
  - Запит: `GET /api/v1/{lang}/consumables/storages/all`
  - Запит: `DELETE /api/v1/{lang}/consumables/storages/delete?netId=`
  - Успіх: Notification «Склад видалено», рядок зникає локально
  - Помилка: Alert
- [ ] **Списання (deprecated orders) — фільтр** _(filter)_ — Drawer складу → вкладка списань, дати + пошук
  - Поля: from/to (date); Пошук (text)
  - Запит: `GET /api/v1/{lang}/consumables/orders/depreciated/all/filtered?from&to&storageNetId&value`
  - Успіх: Таблиця списань
  - Помилка: Alert
- [ ] **Створення/редагування списання** _(action-modal)_ — Кнопка + у drawer складу / редагування рядка (модалка 80vw)
  - Поля: Голова комісії (user search); Отримувач списання* (user search); Коментар; Спочатку дорожчі (checkbox expensiveFirst); Позиції*: товар*, кількість* (>0), стаття витрат* на кожну позицію
  - Запит: `POST /api/v1/{lang}/consumables/orders/depreciated/new?expensiveFirst=`
  - Запит: `POST /api/v1/{lang}/consumables/orders/depreciated/update?expensiveFirst=`
  - Запит: `GET /api/v1/{lang}/usermanagement/profiles/search?value=`
  - Запит: `GET /api/v1/{lang}/payments/costs/movements/all/search?value=`
  - Валідація: ≥1 позиція, отримувач, кожна позиція: товар, qty>0, стаття витрат; дубль товару → «Товар вже додано до списання»
  - Успіх: Notification + reload списань
  - Помилка: Alert у модалці
  - ⚠ expensiveFirst передається як query — перевірити що галочка реально впливає на розрахунок FIFO/LIFO
- [ ] **Видалення списання** _(action-modal)_ — Смітник на рядку списання
  - Запит: `DELETE /api/v1/{lang}/consumables/orders/depreciated/delete?netId=`
  - Успіх: Notification «Списання видалено» + reload
  - Помилка: Alert

### `/accounting/storages/new | /edit/:id` — Склад — створення/редагування

- [ ] **Форма складу** _(create)_ — Кнопка створення / редагування зі списку (drawer)
  - Поля: Назва* (required); Опис (text); Організація* (select, disabled у edit); Відповідальний* (user autocomplete: GET /usermanagement/profiles/search)
  - Запит: `POST /api/v1/{lang}/consumables/storages/new`
  - Запит: `POST /api/v1/{lang}/consumables/storages/update`
  - Запит: `GET /api/v1/{lang}/consumables/storages/get?netId=`
  - Запит: `GET /api/v1/{lang}/organizations/all`
  - Валідація: Назва, організація, відповідальний — покрокові помилки; canSave по правах
  - Успіх: Notification «Склад створено/оновлено» + navigate назад
  - Помилка: Alert

### `/accounting/supplier-organizations` — Постачальники послуг

- [ ] **Фільтр + пошук** _(filter)_ — Дати від/до + пошук
  - Поля: from/to (date); Пошук (text)
  - Запит: `GET /api/v1/{lang}/supplies/organizations/all/search?from&to&limit&offset&value`
  - Успіх: Таблиця
  - Помилка: Alert
- [ ] **Експорт документа** _(action-modal)_ — Кнопка експорту
  - Запит: `GET /api/v1/{lang}/supplies/organizations/document?from&to&value`
  - Успіх: Модалка «Документ» з посиланнями DocumentURL/PdfDocumentURL
  - Помилка: Alert
  - ⚠ Немає loading-індикації тривалого формування документа — перевірити повторні кліки

### `/accounting/supplier-organizations/new | /edit/:id` — Постачальник послуг — картка

- [ ] **Загальні дані + контакти** _(edit)_ — Drawer форми
  - Поля: Назва* (required); Email (формат email); Контактна особа: Email (формат); інші текстові реквізити
  - Запит: `POST /api/v1/{lang}/supplies/organizations/new — створення`
  - Запит: `POST /api/v1/{lang}/supplies/organizations/update — редагування`
  - Запит: `GET /api/v1/{lang}/supplies/organizations/get?netId=`
  - Валідація: validateGeneralForm: назва required, email regex; validateContactForm: email regex
  - Успіх: Notification «Постачальника послуг збережено»
  - Помилка: Alert
- [ ] **Договори постачальника (sub-drawer)** _(edit)_ — Кнопка + Договір / редагування договору
  - Поля: Назва договору* (required); Номер; Організація* + Валюта* (select); Діє з/до (date); Файли (multiple upload)
  - Запит: `POST /api/v1/{lang}/supplies/organizations/agreement/new — multipart (agreementInString + files)`
  - Запит: `POST /api/v1/{lang}/supplies/organizations/agreement/update — multipart`
  - Запит: `GET /api/v1/{lang}/currencies/all, GET /api/v1/{lang}/organizations/all`
  - Валідація: Назва, організація+валюта обов'язкові
  - Успіх: Notification «Договір збережено» + reload організації
  - Помилка: onError → Alert
  - ⚠ Видалення документа договору реалізовано через повторний agreement/update з позначкою Deleted — перевірити що файли не губляться
- [ ] **Видалення постачальника** _(action-modal)_ — Кнопка Видалити → модалка
  - Запит: `DELETE /api/v1/{lang}/supplies/organizations/delete?netId=`
  - Успіх: Notification + navigate на список
  - Помилка: Alert

### `/accounting/supplier-organizations/cash-flow/:id` — Взаєморозрахунки з постачальником

- [ ] **Фільтр періоду** _(filter)_ — Дати від/до
  - Поля: from/to (date, з валідацією діапазону)
  - Запит: `GET /api/v1/{lang}/accounting/cashflow/get/filtered?from&to&netId&typePaymentTask`
  - Успіх: Грід руху коштів
  - Помилка: Alert
- [ ] **Друк PDF** _(action-modal)_ — Кнопка друку
  - Запит: `GET /api/v1/{lang}/accounting/cashflow/document/export?netId&from&to`
  - Успіх: Відкриття PDF у новому вікні (pending window), fallback — модалка з посиланням
  - Помилка: Закриття pending-вікна + Alert
  - ⚠ Popup-блокувальник: перевірити fallback-модалку «Друк PDF»

### `/accounting/payment-cashflow-articles (+ /new, /edit/:id)` — Статті руху коштів

- [ ] **Пошук статей** _(filter)_ — Поле пошуку
  - Поля: Пошук (text)
  - Запит: `GET /api/v1/{lang}/payments/movements/all`
  - Запит: `GET /api/v1/{lang}/payments/movements/all/search?value=`
  - Успіх: Таблиця
  - Помилка: Alert
- [ ] **Форма статті (drawer /new, /edit/:id)** _(create)_ — Кнопка створення / рядок
  - Поля: Назва операції* (required, trim)
  - Запит: `POST /api/v1/{lang}/payments/movements/new`
  - Запит: `POST /api/v1/{lang}/payments/movements/update`
  - Запит: `GET /api/v1/{lang}/payments/movements/get?netId=`
  - Валідація: Порожня назва → «Вкажіть назву статті руху коштів»; canSave/canDelete по правах
  - Успіх: Notification + navigate назад зі state.mutated → reload списку
  - Помилка: Alert у drawer
- [ ] **Видалення статті** _(action-modal)_ — Кнопка Видалити у drawer → підтвердження
  - Запит: `DELETE /api/v1/{lang}/payments/movements/delete?netId=`
  - Успіх: Notification + navigate
  - Помилка: Alert
  - ⚠ Стаття може використовуватись у платежах — перевірити реакцію на 4xx від сервера

### `/accounting/income-cashflows` — Прибуткові ордери

- [ ] **Фільтри прибуткових ордерів** _(filter)_ — Дати, валюта, рахунок, організації (multi), пошук
  - Поля: from/to; Валюта; Рахунок; Організації (multiselect); Пошук
  - Запит: `GET /api/v1/{lang}/payments/orders/income/all?from&to&limit&offset&currencyNetId&registerNetId&organizationIds&value`
  - Запит: `GET /api/v1/{lang}/payments/orders/income/get?netId= — деталі`
  - Запит: `Довідники: /currencies/all, /organizations/all, /payments/registers/search, /payments/movements/all`
  - Успіх: Таблиця
  - Помилка: Alert
- [ ] **Скасування прибуткового ордера** _(action-modal)_ — Дія на рядку → модалка «Скасувати прибутковий ордер»
  - Запит: `PUT /api/v1/{lang}/payments/orders/income/cancel?netId=`
  - Успіх: Модалка закривається, reload
  - Помилка: Помилка на сторінці (Alert)
  - ⚠ Як і у видаткових — помилка не в модалці
- [ ] **Переназначити клієнта** _(action-modal)_ — Дія «Переназначити клієнта» на рядку
  - Поля: Клієнт* (autocomplete, debounce); Договір* (select, підтягується після вибору клієнта)
  - Запит: `PUT /api/v1/{lang}/payments/orders/income/update/client?clientNetId&clientAgreementNetId&incomeNetId`
  - Запит: `GET /api/v1/{lang}/clients/payers/search/all?value&limit=20&offset=0`
  - Запит: `GET /api/v1/{lang}/agreements/client/all?netId=`
  - Валідація: Кнопка Зберегти disabled поки не вибрані клієнт і договір
  - Успіх: Модалка закривається, reload (без notification)
  - Помилка: Alert у модалці
  - ⚠ Немає success-notification

### `/accounting/income-cashflows/new/client` — Прибутковий ордер — від клієнта/постачальника

- [ ] **Форма прибуткового (клієнт)** _(create)_ — /new/client?operationType=&registerType= (оплата клієнта / повернення постачальника / інші надходження; каса або банк)
  - Поля: Сума* (>0); Стаття руху*; Контрагент* (клієнт або постачальник — перемикач пошуку); Договір; Організація*; Каса/рахунок*; Валюта*; Курс/еквівалент; Автоматичне рознесення (checkbox autoAllocate); Рахунки-борги клієнта (checkbox-грід з сумами; disabled при autoAllocate); Дата/час, коментар
  - Запит: `POST /api/v1/{lang}/payments/orders/income/new?auto={autoAllocate} — сабміт`
  - Запит: `GET /api/v1/{lang}/clients/all/filtered | /clients/suppliers/all/filtered | /supplies/organizations/all/search — пошук контрагента`
  - Запит: `GET /api/v1/{lang}/agreements/client/all?netId=, GET /api/v1/{lang}/supplies/organizations/agreements/by?id=`
  - Запит: `GET /api/v1/{lang}/clients/get/debt/total?netId= — борги`
  - Запит: `GET /api/v1/{lang}/exchangerates/get/specific, GET /api/v1/{lang}/payments/orders/income/exchange/calculate`
  - Запит: `POST /api/v1/{lang}/payments/movements/new — інлайн-стаття`
  - Валідація: validateForm: сума>0, стаття, контрагент, організація, рахунок, валюта; validateDebtSelection: якщо вибрані борги без autoAllocate — сума рознесення > 0
  - Успіх: Notification «Прибутковий ордер створено» + navigate на список
  - Помилка: Alert; кнопка loading
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91): auto-рознесення по боргах (query auto=true) — перевірити суми по рахунках, часткові оплати, переплату

### `/accounting/income-cashflows/new/conversion` — Прибутковий ордер — конверсія/інші надходження

- [ ] **Форма конверсії** _(create)_ — /new/conversion?type= (default з /new)
  - Поля: Організація*; Каса/рахунок*; Валюта*; Стаття руху*; Сума* (>0); Контрагент (тільки банківський режим); Курс євро (auto); Дата/час, коментар
  - Запит: `POST /api/v1/{lang}/payments/orders/income/new?auto=false`
  - Запит: `GET /api/v1/{lang}/exchangerates/get/current — курс EUR`
  - Запит: `GET /api/v1/{lang}/payments/orders/income/exchange/calculate`
  - Валідація: організація→рахунок→валюта→стаття→сума>0
  - Успіх: Notification + navigate
  - Помилка: Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91)

### `/accounting/income-cashflows/new/shop` — Прибутковий ордер — інтернет-магазин (retail)

- [ ] **Форма оплати retail-клієнта** _(create)_ — /new/shop (в т.ч. deep-link з /accounting/payment-online-shop з saleId → авто-autoAllocate)
  - Поля: Retail-клієнт* (search); Договір* (Agreement required); Організація*; Каса/рахунок*; Валюта*; Стаття руху*; Сума* (>0); Авторознесення (checkbox); Рахунки для оплати* якщо є борги (при autoAllocate — «Оберіть рахунок для автоматичного рознесення»)
  - Запит: `POST /api/v1/{lang}/payments/orders/income/new?auto={autoAllocate}`
  - Запит: `GET /api/v1/{lang}/retail/clients/sales/filtered?value=`
  - Запит: `GET /api/v1/{lang}/agreements/retail/client/all?netId=`
  - Валідація: validateForm + validateDebtSelection (якщо є видимі борги — вибір рахунку обов'язковий)
  - Успіх: Notification + navigate
  - Помилка: Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91): deep-link із saleId має пред-вибирати борг і вмикати autoAllocate — перевірити

### `/accounting/income-cashflows/new/user` — Прибутковий ордер — повернення від колеги

- [ ] **Форма повернення від колеги** _(create)_ — /new/user
  - Поля: Стаття руху*; Колега* (GET /usermanagement/profiles/search); Організація*; Каса/рахунок*; Валюта* (+currency register); Сума* (>0); Дата/час, коментар
  - Запит: `POST /api/v1/{lang}/payments/orders/income/new?auto=false`
  - Валідація: стаття→колега→організація→рахунок→валюта→сума>0
  - Успіх: Notification «Повернення від колеги створено» + navigate
  - Помилка: Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91)

### `/accounting/payment-expense-articles (+ /new, /edit/:id)` — Статті грошових витрат

- [ ] **Пошук + форма статті витрат** _(create)_ — Пошук на списку; drawer /new, /edit/:id
  - Поля: Назва операції* (required)
  - Запит: `GET /api/v1/{lang}/payments/costs/movements/all`
  - Запит: `GET /api/v1/{lang}/payments/costs/movements/all/search?value=`
  - Запит: `GET /api/v1/{lang}/payments/costs/movements/get?netId=`
  - Запит: `POST /api/v1/{lang}/payments/costs/movements/new`
  - Запит: `POST /api/v1/{lang}/payments/costs/movements/update`
  - Запит: `DELETE /api/v1/{lang}/payments/costs/movements/delete?netId=`
  - Валідація: Порожня назва блокується; права canSave/canDelete
  - Успіх: Notification + navigate назад
  - Помилка: Alert у drawer

### `/accounting/payment-accounts` — Грошові рахунки

- [ ] **Фільтри рахунків** _(filter)_ — Організація, тип рахунку, пошук
  - Поля: Організація (select); Тип (select); Пошук (text)
  - Запит: `GET /api/v1/{lang}/payments/registers/all?organizationNetId&type&value`
  - Запит: `GET /api/v1/{lang}/organizations/all`
  - Успіх: Таблиця + TotalEuroAmount
  - Помилка: Alert

### `/accounting/payment-accounts/new | /edit/:id` — Грошовий рахунок — картка + перекази/обміни

- [ ] **Форма рахунку** _(edit)_ — Drawer; в edit потрібно натиснути «Редагувати» (isEditing) перед сабмітом
  - Поля: Назва* (required); Організація* (select); Валюти* (мін. 1 при створенні, чекбокси currencyDrafts); Тип (каса/банк/картка); Для картки: банк*, номер картки*, термін дії*; Для банку: BIC≤20, Swift≤50, IBAN≤50, місто≤100, номер рахунку≤50
  - Запит: `POST /api/v1/{lang}/payments/registers/new`
  - Запит: `POST /api/v1/{lang}/payments/registers/update`
  - Запит: `GET /api/v1/{lang}/payments/registers/get?netId=`
  - Запит: `GET /api/v1/{lang}/currencies/all, /organizations/all, /bank/all`
  - Валідація: validateForm: права, назва, організація, валюта (create), спец-правила для картки/банку (ліміти довжин)
  - Успіх: Notification «Рахунок створено/оновлено»; після create — navigate на /edit/:netUid
  - Помилка: Alert
  - ⚠ Сабміт у edit ігнорується без режиму isEditing — QA перевірити, що кнопка недоступна/зрозуміла
- [ ] **Новий переказ між рахунками** _(action-modal)_ — Кнопка «Новий переказ» у drawer рахунку
  - Поля: Валюта списання*; Рахунок зарахування* (≠ списання); Сума* (>0); Стаття руху*; Дата+час*; Тип операції
  - Запит: `POST /api/v1/{lang}/payments/registers/transfers/new`
  - Запит: `GET /api/v1/{lang}/payments/registers/by/bank?paymentRegisterNetId=`
  - Запит: `GET /api/v1/{lang}/payments/movements/all`
  - Валідація: validateTransferDraft (усі поля, заборона того ж рахунку)
  - Успіх: Notification «Переказ створено» + reload активності
  - Помилка: Alert у модалці
  - ⚠ ПІДВИЩЕНИЙ РИЗИК: рух грошей; перевірити залишки після переказу
- [ ] **Новий обмін валют** _(action-modal)_ — Кнопка «Новий обмін валют»
  - Поля: Валюта списання*; Валюта зарахування* (інша); Сума* (>0, ≤ залишку); Курс* (>0); Стаття руху*; Дата+час*; Трейдер (GET /currencies/traders/find/currency)
  - Запит: `POST /api/v1/{lang}/payments/registers/exchanges/new`
  - Запит: `GET /api/v1/{lang}/payments/registers/exchanges/calculate?amount&currencyCode&exchangeRate — превʼю суми`
  - Запит: `GET /api/v1/{lang}/currencies/traders/find/currency?netId=`
  - Валідація: validateExchangeDraft: різні валюти, сума>0 і ≤ Amount, курс>0, стаття, дата/час
  - Успіх: Notification «Обмін валют створено»
  - Помилка: Alert
  - ⚠ ПІДВИЩЕНИЙ РИЗИК: перевірити крос-курс і залишки в обох валютах
- [ ] **Скасування переказу/обміну** _(action-modal)_ — Дія на рядку активності
  - Запит: `PUT /api/v1/{lang}/payments/registers/transfers/cancel?netId=`
  - Запит: `PUT /api/v1/{lang}/payments/registers/exchanges/cancel?netId=`
  - Успіх: Notification «Переказ скасовано» / «Обмін валют скасовано»
  - Помилка: Червона notification
- [ ] **Активність рахунку (фільтр)** _(filter)_ — Дати + валюта на вкладках Перекази/Обміни/Рух
  - Поля: from/to; Валюта
  - Запит: `GET /api/v1/{lang}/payments/registers/transfers/all`
  - Запит: `GET /api/v1/{lang}/payments/registers/exchanges/all`
  - Запит: `GET /api/v1/{lang}/payments/registers/currencies/get/filtered`
  - Успіх: Таблиці активності
  - Помилка: catch (activityError) → Alert
- [ ] **Видалення рахунку** _(action-modal)_ — Кнопка Видалити → підтвердження
  - Запит: `DELETE /api/v1/{lang}/payments/registers/delete?netId=`
  - Успіх: Notification + navigate
  - Помилка: Alert

### `/accounting/vat-reports` — Звіти ПДВ

- [ ] **Фільтр періоду** _(filter)_ — Дати від/до + пагінація
  - Поля: from/to (date)
  - Запит: `GET /api/v1/{lang}/vats/info/get/filtered?from&to&limit&offset`
  - Успіх: Таблиця (read-only, мутацій немає)
  - Помилка: Alert

### `/accounting/advance-payments` — Авансові платежі

- [ ] **Фільтр періоду** _(filter)_ — Дати від/до + пагінація
  - Поля: from/to (date)
  - Запит: `GET /api/v1/{lang}/payments/advance/all?from&to&limit&offset`
  - Успіх: Таблиця (read-only)
  - Помилка: Alert

### `/accounting/banks` — Банки

- [ ] **Пошук банків** _(filter)_ — Поле пошуку
  - Поля: Пошук (text)
  - Запит: `GET /api/v1/{lang}/bank/all — один раз; пошук фільтрує ЛОКАЛЬНО (без сервера)`
  - Успіх: Відфільтрована таблиця
  - Помилка: Alert
- [ ] **Банк — створення/редагування** _(action-modal)_ — Кнопка «Новий банк» / рядок
  - Поля: Назва* (required); МФО* (рівно 6 символів); ЄДРПОУ* (required); Місто, Телефони, Адреса (text)
  - Запит: `POST /api/v1/{lang}/bank/update — і для create, і для edit`
  - Валідація: validateBank: назва, МФО=6 символів, ЄДРПОУ
  - Успіх: Notification, модалка закривається, список оновлюється з відповіді
  - Помилка: Alert
  - ⚠ Один ендпоінт update для створення й редагування — перевірити дублікати при повторному сабміті
- [ ] **Видалення банку** _(action-modal)_ — Смітник → модалка «Видалити банк»
  - Запит: `POST /api/v1/{lang}/bank/update — з прапором Deleted (НЕ DELETE-запит)`
  - Успіх: Notification «Банк видалено»
  - Помилка: Alert
  - ⚠ М'яке видалення через update — перевірити, що банк зникає і не ламає рахунки, які на нього посилаються

### `/accounting/company-cars` — Автомобілі компанії

- [ ] **Пошук автомобілів** _(filter)_ — Поле пошуку
  - Поля: Пошук (text)
  - Запит: `GET /api/v1/{lang}/consumables/company/cars/all`
  - Запит: `GET /api/v1/{lang}/consumables/company/cars/all/search?value=`
  - Успіх: Таблиця; рядок → форма/шляхові листи
  - Помилка: Alert

### `/accounting/company-cars/new | /edit/:id` — Автомобіль компанії — форма

- [ ] **Форма автомобіля** _(create)_ — Drawer
  - Поля: Марка (text); Номерний знак (text); Кількість пального* (number >0); Пробіг* (number >0); Вміст баку (number, має бути ≥ пального); Витрати місто/траса/змішаний (number); Організація (select)
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/new`
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/update`
  - Запит: `GET /api/v1/{lang}/consumables/company/cars/get?netId=`
  - Запит: `GET /api/v1/{lang}/organizations/all`
  - Валідація: Пальне і пробіг обов'язкові; бак < пального → «Вміст баку менший ніж кількість топлива»
  - Успіх: Notification + navigate назад
  - Помилка: Alert
  - ⚠ Марка/номер НЕ обов'язкові — можна створити авто без ідентифікації
- [ ] **Видалення автомобіля** _(action-modal)_ — Кнопка Видалити
  - Запит: `DELETE /api/v1/{lang}/consumables/company/cars/delete?netId=`
  - Успіх: Notification «Автомобіль компанії видалено» + navigate
  - Помилка: Alert

### `/accounting/company-cars/:id/road-lists` — Шляхові листи автомобіля

- [ ] **Фільтр шляхових листів** _(filter)_ — Дати від/до
  - Поля: from/to (date)
  - Запит: `GET /api/v1/{lang}/consumables/company/cars/roadlists/all/filtered?companyCarNetId&from&to`
  - Успіх: Таблиця
  - Помилка: Alert
- [ ] **Шляховий лист — створення/редагування (модалка)** _(action-modal)_ — Кнопка + / рядок
  - Поля: Дата, маршрут, пробіг, водії (multi); Відповідальний; Видатковий ордер авто (select із GET /payments/orders/outcome/all/companycar); Розраховані поля (авто-calculate)
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/roadlists/new`
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/roadlists/update`
  - Запит: `POST /api/v1/{lang}/consumables/company/cars/roadlists/calculate — авто-перерахунок при змінах`
  - Запит: `GET /api/v1/{lang}/payments/orders/outcome/all/companycar?netId=`
  - Запит: `GET /api/v1/{lang}/usermanagement/profiles/search`
  - Валідація: canSave по правах; блок якщо outcomeError; розрахунок може повернути помилку — показується в модалці
  - Успіх: Notification «Шляховий лист створено/оновлено», модалка закривається
  - Помилка: Alert у модалці
  - ⚠ Часті calculate-запити — перевірити збереження під час незавершеного розрахунку
- [ ] **Видалення шляхового листа** _(action-modal)_ — Смітник → модалка
  - Запит: `DELETE /api/v1/{lang}/consumables/company/cars/roadlists/delete?netId=`
  - Успіх: Notification «Шляховий лист видалено»
  - Помилка: Alert

### `/accounting/currency-convertors` — Валютні трейдери + курси

- [ ] **Курси трейдера (drawer, інлайн-редагування)** _(inline)_ — Клік по трейдеру → drawer курсів; фільтр дат from/to; кнопки додати/редагувати/видалити курс
  - Поля: Дата курсу (date); Курс по кожній валюті (number) — додавання рядка; Інлайн-редагування ExchangeRate (>0)
  - Запит: `GET /api/v1/{lang}/currencies/traders/all`
  - Запит: `GET /api/v1/{lang}/currencies/traders/exchangerates/get/filtered?netId&from&to`
  - Запит: `POST /api/v1/{lang}/currencies/traders/update — збереження/редагування/видалення курсу (весь payload трейдера з масивом курсів; видалення через Deleted=true)`
  - Валідація: Редагування: курс > 0; ДОДАВАННЯ нового курсу НЕ валідується (можна зберегти нулі)
  - Успіх: Notification «Курс валют збережено/видалено» + reload курсів
  - Помилка: ratesError → Alert у drawer
  - ⚠ saveNewRate без валідації значень — можливо зберегти нульові/порожні курси
  - ⚠ Видалення курсу без модалки підтвердження
  - ⚠ Мутація всього трейдера цілком — конкурентне редагування двома користувачами перезапише курси

### `/accounting/currency-convertors/new | /edit/:id` — Валютний трейдер — форма

- [ ] **Форма трейдера** _(create)_ — Drawer (backgroundLocation)
  - Поля: Прізвище (text); Ім'я (text); По батькові (text); Телефон (text)
  - Запит: `POST /api/v1/{lang}/currencies/traders/new`
  - Запит: `POST /api/v1/{lang}/currencies/traders/update`
  - Запит: `GET /api/v1/{lang}/currencies/traders/get?netId=`
  - Валідація: ЖОДНОЇ клієнтської валідації полів — лише перевірка прав (canSave); можна створити повністю порожнього трейдера
  - Успіх: Notification «Валютного трейдера створено/оновлено» + navigate
  - Помилка: Alert
  - ⚠ Відсутня валідація обов'язкових полів — high-value QA кейс

### `/accounting/payment-online-shop` — Оплати інтернет-магазину

- [ ] **Фільтри оплат** _(filter)_ — Дата продажу від/до, номер продажу (debounce 400ms), телефон (debounce)
  - Поля: saleDateFrom/To (date); Номер продажу (text); Телефон (text)
  - Запит: `GET /api/v1/{lang}/sales/payment/images/get/filtered?saleDateFrom&saleDateTo&saleNumber&phoneNumber&limit&offset`
  - Успіх: Таблиця + paginator
  - Помилка: Alert
- [ ] **Додавання платежу (detail drawer)** _(create)_ — Клік по рядку → drawer → форма додавання
  - Поля: Сума* (NumberInput >0); Тип оплати* (Select); Зображення/квитанція* (FileInput); Коментар (text)
  - Запит: `POST /api/v1/{lang}/retail/clients/new/payment/item — multipart (paymentImageItem JSON + image)`
  - Валідація: amount>0 + paymentType + image — але при невалідних даних сабміт ПРОСТО НЕ СПРАЦЬОВУЄ без повідомлення
  - Успіх: Notification «Платіж створено», drawer закривається, reload
  - Помилка: createError → Alert («Сталася помилка, заповніть поля!»)
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (create-платежів): мовчазний no-op при невалідній формі — користувач не розуміє чому кнопка «не працює»
- [ ] **Редагування платежу** _(action-modal)_ — Клік по item у списку платежів drawer-а → модалка «Редагування»
  - Поля: Сума (number); Коментар (text)
  - Запит: `POST /api/v1/{lang}/retail/clients/update/payment/item`
  - Успіх: Модалка закривається, item оновлюється локально (без notification)
  - Помилка: editError → Alert
  - ⚠ Fallback на локальне оновлення якщо відповідь неповна — можлива розбіжність з сервером до reload
- [ ] **Створити прибутковий ордер з продажу** _(action-modal)_ — Дія на рядку → навігація на /accounting/income-cashflows/new/shop?saleId=
  - Запит: `Навігація (deep-link)`
  - Успіх: Відкривається форма shop-ордера з пред-вибраним боргом
  - Помилка: -
  - ⚠ Перевірити зв'язку deep-link → autoAllocate

### `/accounting/sync/documents` — Синхронізація документів (Balances)

- [ ] **Фільтри документів синхронізації** _(filter)_ — Дати, назва, тип документа + пагінація
  - Поля: from/to (date); name (text); type (select)
  - Запит: `GET /api/v1/{lang}/documents/sync/get?from&to&limit&offset&name&type`
  - Успіх: Таблиця (read-only)
  - Помилка: Alert

### `/accounting/available-payments (+ alias /payments/available)` — Наявні платежі (платіжні задачі)

- [ ] **Фільтри платіжних задач** _(filter)_ — Дати, організація, тип задачі, «тільки доступні до оплати» (toggle)
  - Поля: from/to; Організація (select); typePaymentTask (select); onlyAvailableForPayment (switch)
  - Запит: `GET /api/v1/{lang}/payments/tasks/grouped/all/filtered або /payments/tasks/grouped/all/available/filtered`
  - Запит: `GET /api/v1/{lang}/organizations/all`
  - Успіх: Групи задач + PriceTotals
  - Помилка: Alert
- [ ] **Позначення задач до оплати (multi-select)** _(inline)_ — Чекбокси на задачах + кнопка «Створити видатковий»
  - Запит: `Без запитів — клієнтська валідація вибірки (validateAvailablePaymentSelection/Merge)`
  - Валідація: Заборона змішувати несумісні задачі (валюта/організація/агрумент) — помилка при спробі відмітити
  - Успіх: Відкриття форми видаткового у drawer
  - Помилка: setError → Alert
- [ ] **Перевести задачу в активні (move to done)** _(action-modal)_ — Дія в detail drawer, вимагає документи
  - Поля: Документи* (upload, ≥1)
  - Запит: `POST /api/v1/{lang}/payments/tasks/available/set — multipart (task JSON + documents)`
  - Запит: `GET /api/v1/{lang}/payments/tasks/get?netId=`
  - Валідація: «Додайте хоча б один документ»
  - Успіх: Notification «Платіжну задачу оновлено» + reload
  - Помилка: Alert
- [ ] **Об'єднання платіжних задач** _(action-modal)_ — Кнопка Merge для відмічених
  - Запит: `POST /api/v1/{lang}/payments/tasks/merge — масив задач`
  - Валідація: validateAvailablePaymentMerge
  - Успіх: Notification «Платіжні задачі об'єднано» + reload
  - Помилка: Alert
- [ ] **Створення видаткового ордера по задачах** _(create)_ — Форма в drawer після вибору задач
  - Поля: Дата* + час*; Організація*; Грошовий рахунок*; Валюта*; Стаття грошових витрат* (+ інлайн-створення); Сума* (>0); Курс (авто: GET exchangerates); Номер (custom), Коментар, Призначення платежу; IsAccounting/IsManagementAccounting; Документи до кожної задачі (обов'язкові, якщо не запуск із відмічених)
  - Запит: `POST /api/v1/{lang}/payments/orders/outcome/new/supplies — multipart (order JSON + documents)`
  - Запит: `GET /api/v1/{lang}/exchangerates/get/specific або /exchangerates/gov/get/specific (якщо організація 'ТОВ «АМГ «КОНКОРД»')`
  - Запит: `GET /api/v1/{lang}/payments/orders/income/exchange/calculate`
  - Запит: `POST /api/v1/{lang}/payments/movements/new`
  - Запит: `GET /api/v1/{lang}/accounting/cashflow/get/filtered — вкладка руху коштів по задачі`
  - Валідація: validateOutcomeForm: задачі, дата, час, організація, рахунок, валюта, стаття, сума>0; + повторна валідація вибірки; + документи до кожної задачі якщо requireDocuments
  - Успіх: Notification «Видатковий ордер створено», drawer закривається, вибірка чиститься, reload
  - Помилка: Alert; confirm-модалка при закритті drawer з незбереженими файлами
  - ⚠ ПІДВИЩЕНИЙ РИЗИК (фікси 88–91): найкритичніший create-path — multipart з JSON-ордером
  - ⚠ Хардкод назви організації для держкурсу — крихка логіка
  - ⚠ ExchangeRate=0 надсилається якщо курс ≤ 0

## Прогалини, знайдені крос-перевіркою (додати до прогону)

- [ ] /accounting/specification-codes — ProductSpecificationCodesPage (src/features/product-specification-codes) повністю відсутня в інвентаризації (ані в ТОВАРИ, ані в ОБЛІК), хоча оголошена в migratedConsoleRoutes (consoleRoutes.tsx:159)
- [ ] /accounting/specification-codes/uk — та сама сторінка, окремий шлях (consoleRoutes.tsx:160)
- [ ] /sales — неочевидний аліас: рендерить BasketSupplyUkraineOrderPage (кошик поставки), а не список продажів (consoleRoutes.tsx:323); в інвентаризації не згаданий
- [ ] /recommendations — ще один аліас BasketSupplyUkraineOrderPage (consoleRoutes.tsx:307); формально поза названими групами, але тестується як той самий кошик
- [ ] **ТОВАРИ/ОБЛІК** — src/features/product-specification-codes/pages/ProductSpecificationCodesPage.tsx (роут /accounting/specification-codes): Ціла сторінка «Специфікаційні коди»: (1) фільтр з двома дебаунс-пошуками vendorCode/specificationCode → GET /specifications/get/all/filtered; (2) імпорт Excel через FileButton → POST /products/specification/new/all/file + SpecificationUploadResultModal з результатом парсингу; (3) drawer ChangeProductSpecificationPanel (components/ChangeProductSpecificationPanel.tsx) — зміна коду/митної вартості/мита/ПДВ з режимами (Radio changeMode), полем підтвердження коду, permission Accounting_Specification_codes_ChangeBtn_PKEY і confirm-close модалкою → POST /specifications/change
- [ ] **ТОВАРИ (глобальний хедер)** — src/features/header-actions/components/ProductWriteOffRulesControl.tsx (рендериться в HeaderActionBar на всіх сторінках): Керування ГЛОБАЛЬНИМИ правилами списання з хедера: GET /products/writeoff/rules/all/base + видалення правила DELETE /products/writeoff/rules/delete — деструктивна мутація поза будь-яким роутом інвентаризації (інвентаризація покриває лише drawer правил у /products)
- [ ] **СКЛАД (кокпіт закупівель)** — src/features/basket-supply-ukraine-order/api/procurementApi.ts:125: Неточність ендпоінта: чернетка замовлення створюється POST /supplies/ukraine/order/new/cockpit/draft, а в інвентаризації записано /supplies/ukraine/order/new/cockpit (без /draft) — QA буде шукати не той запит у network-табі
- [ ] **ПРОДАЖІ (майстер продажу)** — src/features/sales-ukraine/components/new-sale-wizard/ (WizardReassignSaleModal.tsx, WizardCrossSellModal.tsx, ChangeQtyModal.tsx, ShiftOrderItemModal.tsx, FutureReservationModal.tsx, WizardOrderedProductsDrawer.tsx): Інвентаризація чесно каже «тестувати окремим чеклистом», але конкретні модалки майстра ніде не перелічені: переназначення продажу (WizardReassignSaleModal), крос-сейл, зміна кількості, зсув позиції (POST /orders/items/shift/specific), майбутня резервація — жодна не зафіксована як окрема форма
- [ ] **ПЛАТЕЖІ (створюються з митних сторінок — поза групами роутів, але це payments-мутації зони фіксів 88–91)** — src/features/document-outcome-payment/api/documentOutcomePaymentApi.ts (використовується з src/features/sad/pages/SadPages.tsx та src/features/tax-free-documents/pages/TaxFreeDocumentsPage.tsx): Створення видаткових ордерів з документів SAD/TaxFree: POST /payments/orders/outcome/new/sad та POST /payments/orders/outcome/new/taxfree — окремі create-шляхи платежів, відсутні в модулі ОБЛІК
- [ ] **ПЛАТЕЖІ (митні сторінки)** — src/features/sad/api/sadApi.ts, src/features/tax-free-documents/api/taxFreeDocumentsApi.ts: Ще create-шляхи платежів поза інвентаризацією: POST /payments/orders/income/new/sad, POST /payments/orders/income/new/taxfree, POST /payments/advance/new (авансові платежі створюються саме звідси, а сторінка /accounting/advance-payments описана як read-only без згадки джерела)
- [ ] **ТОВАРИ (мертвий код — для повноти)** — src/features/products/api/productsApi.ts:207 (createProductWithImages → POST /products/new/upload): API створення нового товару існує, але не має жодного UI-виклику — аналогічно вже зафіксованому deleteProductGroup; варто відмітити в notes, що створення товару з UI недоступне
- [ ] **СКЛАД (мертвий код — для повноти)** — src/features/product-delivery-protocols/api/protocolProductIncomeApi.ts:120 (updatePackingListPlacement → POST /supplies/packinglists/placement/info/update): Ендпоінт оголошений, але викликів у компонентах не знайдено (legacy, задокументований у коментарі поруч); інвентаризація згадує його лише в risks — статус «не викликається з UI» варто зафіксувати явно

### Вердикт критика

Інвентаризація дуже повна: з ~60 роутів у групах products/warehouse/orders/supply/sales/resales/reports/accounting/payments покриті всі, крім сторінки «Специфікаційні коди» (/accounting/specification-codes і /uk — ціла сторінка з імпортом Excel і мутацією POST /specifications/change пропущена повністю) та двох неочевидних аліасів (/sales і /recommendations → кошик поставки). Крос-перевірка всіх 327 мутаційних apiRequest-викликів по src/features/** показала, що майже всі POST/PUT/DELETE/PATCH відображені у формах; реальні пропуски — глобальний контрол правил списання в хедері (DELETE правила з будь-якої сторінки), payments-create ендпоінти, що викликаються з митних сторінок SAD/TaxFree (…/outcome/new/sad, …/income/new/taxfree, /payments/advance/new — критично з огляду на зону фіксів 88–91), неперелічені модалки NewSaleWizard і одна неточність шляху (cockpit/draft). Окреме застереження: переданий мені JSON модуля ОБЛІК обірваний посередині секції /accounting/available-payments — я звірив роути за списком сторінок, але фінальні форми цієї секції в наданому тексті неповні, тож їх зміст перевірити не міг.
