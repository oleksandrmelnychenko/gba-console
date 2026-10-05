# Fenix original Purchases: stored resources in Console

The Console contract follows the server resource order:

| Resource | Precision | Default |
| --- | --- | --- |
| КоличествоОборот | 3 decimals | No |
| КоличествоЕдиницОтчетов | 3 decimals | No |
| КоличествоБазовыхЕд | 3 decimals | Yes |
| СтоимостьОборот | 2 decimals | Yes |
| НДСОборот | 2 decimals | Yes |
| ВесОборот | 3 decimals | Yes |

The retained own module `01f65a3bdf8e7768e5c91619196a6fb1c0afe1da04b2e6b569b7a4449376d37a`
calls the UniversalReport initial settings. The retained universal module
`c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17`
enables register resources; the own module changes the three quantity switches.
The reviewed server feature supplies signed stored cost, VAT and weight totals.

The UI accepts all six measures and selects all four original default measures.
Every row and total uses its resource precision, including zero totals. Values
remain canonical strings on screen and in CSV, XLSX and PDF. Signed values wider
than JavaScript's safe integer range retain their exact bytes. The client does
not sum rounded rows or convert currency.

Capability validation requires the server's complete resource order and default
selection. Publish this Console change together with the matching server feature.
Existing permissions, scope echoes, cancellation, complete-input checks and named
selector witnesses remain enforced. Native virtual totals, source parity and
complete original acceptance remain unverified until current-data comparison.

Validation scope: the seven affected Purchases API, contract, named selector,
export, panel and catalogue test files; report-specific lint, full build and
React Doctor for the diff against `5d95e10f4a11dc7303c4b58842b99c5f7c20dad9`.
Actual results are recorded separately after execution.
