# Cash40 account and management columns in Console

The isolated candidate is based on the accepted registrar/buyer-price Console
candidate `a5540721` and includes the Supplier38 filter commit `fcf92f4`
(cherry-picked as `5f146154`). It supports both the legacy four-column capability
and the version-2 eight-column capability. This worktree does not alter the
running DEV Console.

The account picker keeps the exact Int64 string ID and NetUID. On a version-2
server it initially selects eight columns. Changing the currency mode updates
both the request version/basis and selected measurements in the same event.
The four-column mode sends version 1 / `AccountCurrency`; the eight-column mode
sends version 2 / `AccountAndManagementCurrency`. A legacy server only offers
four columns. Saved version-1 requests remain usable on a version-2 server.

The Console does not assign a management currency or convert amounts. It displays
the currency supplied by the server and submits the separate recorded resources.
Server publication coverage, sealed management context and unique active native
currency mapping are required for an eight-column result. The existing Source
capture configuration remains disabled; this candidate does not certify a fresh
management-context publication.

Validation: the full report suite had 3,696 passing tests and one obsolete text
assertion, which was corrected. All eleven affected API/picker/page tests then
passed. TypeScript and production build passed; changed-file ESLint passed.
React Doctor remains 89/100, equal to the initial worktree baseline. The remaining
warnings include existing constructor complexity and unrelated report components.

Deploy together with the matching version-2 server catalogue: an older Console
rejects an unfamiliar version-2 dataset catalogue even though its version-1
generation requests remain compatible. Authenticated DEV browser acceptance
still requires the fresh storage-state session already requested from the user.
