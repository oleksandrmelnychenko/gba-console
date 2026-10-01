# Dataset27 current native Console delivery

## Public behavior

New D27 forms choose `PriceTypeSalesComparison.SalesBasis=0` only when the
server advertises both ordinary calculation and current-choice APIs. The form
reads current OUR organization mappings and product-kind bindings through
`GET /report/datasets/27/current-scope`, independently of captured turnover days.
The Buyers root remains the existing exact Fenix root; no identity is derived
from a local numeric ID or NetUID.

The selected basis is explicit in the editable form. A saved omitted basis,
`null`, or `1` retains its previous signed-register behavior. Opening a saved
form never silently upgrades it. An explicit user basis change preserves its
selected price type, exact scope, filters, and row/column layout; unsupported
ordinary axes or project/division filters are validated visibly.

Ordinary available axes are year, quarter, month, day, organization, product,
article, buyer and agreement. Exact native lookup fields are 51,52,45; their
search requests include `salesBasis=0`. Legacy lookups omit that parameter.
The global price-type lookup 46 continues through the existing API.

The nine measures retain their numeric identities. Captions identify ordinary
money in EUR and quantity as native OUR units. Quantity and actual sale/return
amounts are independent of comparison-price availability. Missing optional
price, before-discount amount, base quantity, unit coefficient or OUR FX is
shown as a null dependent cell and subtotal. This delivery does not claim that
all nine measures are populated or historical Excel numbers are reproduced.

## State and exports

Basis0/1/null/omission are preserved through aliases, clone, draft restoration,
and request construction. The existing full request fingerprint includes the
nested basis. Preview and file export use that same request. A basis change
clears prior preview/files; a response after role loss or after changing the
request cannot reopen stale exports. Managed case aliases are replaced once
when saving, avoiding duplicate root options.

Current choice loading is abortable. Unavailable choices do not erase saved
exact scope selections or become a global readiness prerequisite. No UI
free-text identity editor, new permission, new Source access, or sync trigger
is introduced.

## Integration and checks

Backend order: `7b6e346` ordinary contract, `c6ceea4` current lookup/scope APIs,
then `6218165` root-contract namespace import. Deploy those before this Console
candidate; older base/intermediate capabilities retain their old fresh draft.

Four focused files contain 27 cases (19 added): data contract 12, API 5, panel 5,
page 5. Cases cover default versus saved omission, aliases and request
fingerprints, unavailable ordinary axes, exact native choice/query identities,
independent empty choices, no captured day request in ordinary mode, null
preview values, same preview/export request, basis invalidation and role-loss
stale exports. They were authored offline; root owns all test/build/lint/
React Doctor execution. Static diff review is complete. No SQL or Source
connections were made by this agent.
