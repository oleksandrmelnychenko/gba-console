# Fenix lot balance analysis: Console default

Original `a820d1c6-3eb2-4283-9aa2-de7e80ad0c42`, definition
`0a4eaf2df279934e70ca0eb9ea921fb969aaf1d0ce64364539870ee981154b6b`,
module `f86e1793f36b1ced8bf531c16ffaa8106262eeb32509d4200738bf675b50d781`,
query `35d7c5117690b1ff7f9f81ba335808907b4c9d0fbaa776ad32791099711ff4b2`.

The dedicated catalogue launch binds all three original identity fields and
requires the report generation permission and a current caller. The capability
and preview use `/report/originals/lot-balance-analysis`; no Source connection is
created by the Console. The server reads ordinary synchronized Warehouse and
Sales parents in one OUR Snapshot.

The fixed default is Warehouse → Product, opening quantity, opening cost plus
VAT, closing quantity, closing cost plus VAT. Warehouse and Product selectors
use confirmed captions from OUR data. The source's static Buyer control has no
effective query field in the retained original; this default submits an empty
Buyer selector. Other groupings and saved variants are outside this scope.

Global antiSales selection belongs to the server. Selecting a warehouse does
not narrow the sales population. Full lot opening row presence is checked before
display grouping, using all three underlying resources. The UI performs no
business calculation or currency conversion.

One complete, normalized response supplies the screen, CSV, XLSX and PDF. Signed
fixed-scale strings are retained. Parent and grand totals are checked with exact
integer arithmetic. Missing normal parents carry no amounts or exports; a
complete empty response has explicit zero totals. Changing filters, caller or
permission invalidates the old result and cancels its original request.

This code does not establish a deployment, final sync, native source parity,
authenticated browser acceptance or completion of all 195 originals. Those
remain separate checks against the actual delivered server and current data.
