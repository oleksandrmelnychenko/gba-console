# Патерн: відступи/бордер врапера консольних сторінок + однорядкові клітинки

Повторювана правка, застосована до кількох реєстрових сторінок (`/accounting/income-cashflows`,
`/accounting/outgoing-cashflow`, `/accounting/payment-expense-articles`,
`/accounting/payment-cashflow-articles`, `/clients`, `/products/income/documents`).
Симптоми й фікс однакові — цей файл фіксує рецепт, щоб не вигадувати заново.

## Коли застосовувати

Відкрий сторінку в браузері і подивись на білу картку (шел) з таблицею всередині
`.console-frame`:

1. **Картка впритул до заокругленого верху фрейма** (0px зверху) і/або впритул до
   футера сайту знизу (або з дивним «мертвим» відступом знизу, що не схожий на
   навмисний) → потрібен **фікс відступів**.
2. **Картка взагалі без бордера/тіні** (виглядає «голою», особливо помітно після
   фіксу відступів, коли з'являється проміжок навколо) → потрібен **фікс бордера**.
3. **Текст у клітинках таблиці переноситься на 2+ рядки**, рядки різної висоти →
   потрібен **фікс однорядкових клітинок**.

## 1. Фікс відступів (верх/низ/боки)

### Причина

- `.console-frame` (`src/app/layout/layout.css`) має `margin: 6px 0 0 0` — 6px
  зверху й **0px знизу**.
- Кожна сторінка сама рахує свою висоту через
  `height: calc(100vh - var(--app-shell-header-offset, 108px) - var(--app-shell-footer-offset, 36px) - Npx)`
  і **не** підлаштовується під фактичну висоту фрейма — це паралельний, незалежний
  розрахунок. Якщо константа `N` підібрана «на око» (типово 20 або 24), картка або
  впритул до фрейма зверху (0 паддінга), або лишає «мертвий» запас знизу білого
  кольору (непомітний, бо фон картки/фрейма однаковий — білий).

### Формула (виведена і перевірена на кількох сторінках)

Щоб отримати **рівно 6px зверху і 6px знизу** між карткою і краєм `.console-frame`:

```css
.<page>-page {
  box-sizing: border-box;
  height: calc(100vh - var(--app-shell-header-offset, 108px) - var(--app-shell-footer-offset, 36px) - 12px);
  min-height: 0;
  overflow: hidden;
  padding: 6px 4px 0; /* 6px зверху, 4px по боках, 0 знизу — низ дає висота-калк */
}
```

Ключове: **завжди `-12px` у формулі висоти + `padding: 6px 4px 0`**, незалежно від
того, яка константа була раніше (14, 20, 24 — не важливо, формула самодостатня і
не залежить від старого значення). `box-sizing: border-box` обов'язковий — без
нього `padding-top` додасться ПОВЕРХ висоти і зламає розрахунок.

### Як перевірити результат (без ручного клікання)

```js
const frame = document.querySelector('.console-frame')
const shell = document.querySelector('.<клас картки>') // .console-table-shell АБО Card-клас
const f = frame.getBoundingClientRect()
const s = shell.getBoundingClientRect()
console.log({ topGap: s.top - f.top, bottomGap: f.bottom - s.bottom })
// має бути { topGap: 6, bottomGap: 6 }
```

### Де саме міняти

- Якщо у сторінки вже є власний `<page>-page.css` — редагувати клас `.<page>-page`
  (кореневий `<Stack className="...">`).
- Якщо CSS-файлу нема (сторінка живе тільки на shared `console-table-page.css`) —
  **створити** page-specific CSS-файл з цим правилом і заімпортувати його в
  компоненті (`import './<page>-page.css'` після
  `import '../../../shared/ui/console-table-page.css'`).
- `Stack` рівня сторінки має мати `gap={6}` (не `gap="md"`).

## 2. Фікс бордера картки (тільки для сторінок з Mantine `<Card withBorder>`)

### Причина

`src/app/layout/layout.css`:

```css
.console-frame .mantine-Card-root {
  border: 0;
  box-shadow: none;
}
```

Це глобальне правило навмисно знімає бордер/тінь з БУДЬ-ЯКОГО Mantine `<Card>`
всередині `.console-frame` — розраховане на сторінки, що вже перейшли на патерн
"голий `<div className="console-table-shell">`" (той сам додає собі бордер/фон/
тінь через CSS, не через Mantine-пропси). Сторінки, що досі використовують
`<Card withBorder radius="md">`, від цього правила лишаються БЕЗ бордера і тіні —
непомітно, поки картка впритул до країв фрейма (немає з чим порівняти), але
одразу впадає в очі після фіксу відступів (п.1), коли картка «висить» у порожнечі.

### Фікс

Додати в page CSS (специфічність `!important` обов'язкова — інакше глобальне
правило `.console-frame .mantine-Card-root` переможе):

```css
.<page>-card {
  background: var(--mantine-color-white);
  border: 1px solid var(--mantine-color-gray-2) !important;
  box-shadow: var(--app-card-shadow) !important;
}
```

`<page>-card` — це кастомний клас, який сторінка вже вішає на свій `<Card
className="app-data-card <page>-card" withBorder ...>` (перевір JSX — такий клас
майже завжди вже є, просто без стилів бордера).

### Альтернатива (повний рефакторинг, не обов'язково)

Замість патчити `Card`, можна повністю перевести сторінку на «плаский» патерн
(зроблено для income-cashflows, outgoing-cashflows, payment-cashflow-articles):

- `<Card className="app-data-card X" withBorder radius="md" padding={0}>` →
  `<div className="console-table-shell X">`
- Прибрати внутрішній `<Stack className="X__body" gap="md">` з падінгом — зробити
  дітей (alert/table/footer) прямими нащадками shell, alert отримує клас
  `console-table-alert`, таблицю обгорнути в `<div className="X__table
  console-table-body">`.
- Додати `import '../../../shared/ui/console-table-page.css'` і клас
  `console-table-page` на кореневий `Stack`.
- `.console-table-shell` вже сам несе бордер/фон/тінь (з `filter-bar.css`) — п.2
  тоді не потрібен.

Обирай цей варіант, якщо сторінка невелика і немає ризику зачепити купу
залежної логіки; для великих файлів (1000+ рядків) простіше й безпечніше
обмежитись CSS-патчем із п.2.

## 3. Фікс однорядкових клітинок таблиці

### Причина

Спільний `shared/ui/data-table/data-table.css` дає клітинкам
`overflow: hidden; text-overflow: ellipsis;`, але **не** `white-space: nowrap` —
це свідомо (деякі сторінки хочуть перенос). Якщо колонка рендерить
`<Text lineClamp={2}>...</Text>` (частий копі-паст), клітинка розтягується на
2 рядки, рядки виходять різної висоти.

### Фікс — два кроки разом

1. У JSX прибрати `lineClamp={2}` (або `lineClamp={N>1}`) з клітинок, де рядки
   мають бути однорядкові; додати `title={повний текст}`, щоб довге значення
   було видно в нативному тултіпі при наведенні:

   ```tsx
   cell: (row) => (
     <Text size="sm" title={displayValue(row.client)}>
       {displayValue(row.client)}
     </Text>
   ),
   ```

2. У page CSS додати страхувальний оверрайд (ловить і колонки без `<Text>`,
   що рендерять голий рядок):

   ```css
   .<page>-page__table .data-table-cell {
     white-space: nowrap;
   }

   .<page>-page__table .data-table-cell > * {
     min-width: 0;
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }
   ```

   (селектор-обгортка залежить від сторінки — може бути `.<page>-page__table`,
   `.<page>-card`, тощо — головне, щоб покривав `.data-table-cell` цієї таблиці).

## Чекліст (коротко)

- [ ] `topGap`/`bottomGap` виміряні через `getBoundingClientRect()` = 6/6
- [ ] `box-sizing: border-box` + `height: calc(... - 12px)` + `padding: 6px 4px 0`
      на кореневому `<page>-page`
- [ ] `Stack gap={6}` на корені
- [ ] Якщо сторінка на `<Card withBorder>` — бордер/тінь відновлені
      (`!important`) АБО картку переведено на `console-table-shell`
- [ ] `tsc -b --noEmit` чистий
- [ ] Візуально: скріншот у браузері, немає «голої» картки, немає
      дворядкових клітинок там, де не треба
- [ ] Перевірено хоча б з одним реальним рядком даних (не тільки на порожній
      таблиці — порожня таблиця не покаже проблему з переносом рядків)

## Приклади коммітів-референсів у цьому репо

- `915e1bd` Polish income cashflows page shell
- `a969794` Polish outgoing cashflows page shell
- `86ef6a8` Fix payment expense articles page shell spacing
- `bbf4f48` Polish payment cashflow articles page shell
- `0fabba5` Fix clients page shell spacing and restore card border
