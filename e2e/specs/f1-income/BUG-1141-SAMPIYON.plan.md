# BUG-1141 — SAMPIYON Chrome-recorder coverage

## Source scenarios

- `Замовлення SAmpiyon.json` — supplier, Fenix, EUR agreement, spreadsheet order import.
- `Логістичний шлях Інвойси Паклисти.json` — approval, proforma, 50% payment task, invoice, two packing lists.
- `Оприходування замовлення + митні коди завантаження.json` — delivery protocol, customs import, arrival, placement, capitalization.

The recorder's `C:\fakepath\CCD_23UA400040033270U0 SAMPIYON.xlsx` is not a Desk attachment. Its exact exercised rows were recovered from the invoice document persisted by DEV and are generated deterministically by the E2E helper.

## Acceptance matrix

| Area | UI action | Database proof |
|---|---|---|
| Order | Import rows 5–20 for SAMPIYON under Fenix/EUR | 16 order lines, Qty 463, amount 7720.69 |
| Logistics | Approve and save proforma | saved proforma linked to the order |
| Payment | Create an accounting payment task for 50% | one active task, value equals 50% of proforma |
| Invoice | Import rows 4–21 | 18 invoice lines, Qty 502, amount 8292.61 |
| Packing | Import rows 4–10 and 11–21 as separate lists | exactly two lists; 7+11 rows and 75+427 Qty |
| Delivery/customs | Attach invoice, move in transit, import customs, arrive | one arrived protocol and one real specification per invoice line |
| Income | Place and capitalize both physical packing lists | two document-scoped incomes, 18 items/502 Qty in total, completed outboxes, no consignment twins |

The test must run only on the fenced `_E2E` database and must start from the clean golden snapshot.
