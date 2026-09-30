# Dataset38 Console: exact inclusion/exclusion and grouped variants

This isolated candidate starts from combined registrar/buyer-price source
`a5540721c3dca5bceeb213cc855b5667d724dbc6`. It retains both Dataset38
warehouse forms and the existing permission checks.

The Dataset38 validator now accepts the server's version-1 AND/OR capability
and the existing exact inclusion/exclusion conditions on organization,
product and supplier IDs. Repeated fields require a valid explicit expression;
each enabled original selection must occur once. Disabled rows retain their
indices, and large Int64 IDs remain JSON strings. Supplier exclusions are
enabled only when that server capability is present, so the previous server
retains its inclusive-list behavior. Invalid, omitted, duplicate or unsupported
expression fields refuse template application without altering the saved data.

The existing group editor and report/template API already transmit this
contract. No report-page component change was needed. DOM tests for receipt
axis 73 and registrar axis 78 apply a saved nested variant containing a
disabled product leaf and an exact supplier exclusion, submit it, and save
the same settings back. Both preserve the complete selection list and original
indices. The server performs the checks and calculations on the already
validated supplier shares; the Console adds no attribution or arithmetic.

Validation completed:

- Full reports Vitest: 195 files, 3,694 passing tests, zero failures/skips.
- Production TypeScript/Vite build: passed.
- ESLint for all three changed source/test files: passed.
- React Doctor against `a5540721`: score 98, zero changed-file findings.

No DEV switch, authenticated browser call, Source SQL, sync, or business write
was performed. Backend support is in server commits `24dbafe` and `7f5892c`;
this Console candidate requires that capability before enabling grouped
variants. Signed return/residual supplier calculations and the final full
report statistics check remain separate work.
