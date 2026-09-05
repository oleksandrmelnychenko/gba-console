# Live 1C sync audits

These tests are read-only checks of a completed DEV synchronization. They are
kept outside the disposable golden-suite config because the golden snapshot can
predate the source documents being audited. That separation prevents an old
snapshot from producing a false green result.

Run BUG-1244 against the local DEV SQL port:

```bash
LIVE_SYNC_SQL_PASSWORD='<dev-sa-password>' npm run e2e:live-sync-audit
```

The database fence accepts only the local DEV server identity and
`ConcordDb_V5`. The tests execute `SELECT` statements only.

BUG-1244 covers the complete AYMEKS and SAMPIYON matrices attached in Desk:

- every article, quantity, invoice currency, and unit price;
- duplicated Excel lines aggregated without losing quantity;
- exact per-product 1C delivery-expense allocation;
- the accounting-cost include/exclude note from the attachment;
- a sold-out line retained in document history but absent from current state;
- a legitimate two-storage split distinguished from a duplicate;
- repeated-sync duplicate protection, zero prices, and negative/zero quantities.
