# BUG-1276: actual DEV outcome-scroll verification

## Observed scope

On 2026-09-26, an isolated authenticated Chromium session opened the actual
DEV `/products` page, performed one normal UI search capped at twenty results,
selected one visible product row and opened **Розхід**. No fixture, mocked
response, UI edit, product edit, build or deployment was used. The original
retained authentication file was unchanged, and the named browser session was
closed after verification.

The served Console container was healthy and pinned to
`gba-console:reports-buyers-8680c59`, image SHA-256
`992b7bdf87adfb1f20b759065046d37169e36dc92fce313d4d0de6b84c56b228`.
The chosen real product had **zero outcome movement rows** for the untouched
default period. This establishes the actual empty-table delivery scenario,
not the screenshot's unknown product or a populated movement-table scenario.

## Browser measurements

The same product card and application session were reused at four widths:

| Viewport width | Scroll width | Client width | Maximum scroll | Bottom control |
| --- | --- | --- | --- | --- |
| 1280 | 1900 | 854 | 1046 | Visible within viewport |
| 1560 | 1900 | 1134 | 766 | Visible within viewport |
| 1920 | 1900 | 1494 | 406 | Visible within viewport |
| 2560 | 2134 | 2134 | 0 | Absent when columns fit |

At all three overflowing widths, a real pointer click on the bottom control
moved the table; keyboard `Home`/`End` reached both ends; changing native
`scrollLeft` updated the control; and the last **Кількість** header was reachable.
Control and native scroll positions matched within one pixel. The bottom
control was seventy pixels below the table's rendered header/table rectangle
in this empty-table scenario and remained inside the viewport.

From the bounded product search onward, ten observed fetch/XHR requests used
GET, with zero mutation methods and zero HTTP error responses. No 1C
connection or direct database command was made. The initial attempt to click
the first search row was intercepted by the fixed page header; the actual card
was subsequently opened by clicking a visible row, without forcing the click
or modifying the DOM.

## Retained evidence and limits

Private owned `0700` evidence retains the measurement JSON and cropped
1560-pixel outcome-frame screenshot as `0600` files. No business values,
product identifiers, authentication data or signed URLs are published here.

- Measurement receipt SHA-256:
  `fe6e13cb1d9745a70e0a9b187656fee8606065f8be98c0862ebdfc7095ef5354`.
- Cropped frame screenshot SHA-256:
  `87cab17f1079d7ea75a1ea36aedea570a65b7d1ef88610b418d933995cf86a1a`.

**Four actual browser scenarios passed within this scope.** Exact parity with
`Screenshot_358.png`, the user's unknown product and a populated outcome table
remain unverified. BUG-1276 was not marked closed, and no QA Desk comment was
sent. The [earlier implementation audit](qa-desk-bug-1276-outcome-scroll-audit-20260924.md)
remains the source for the original screenshot and fixture evidence; this
record adds actual DEV empty-table delivery evidence only.
