# Dataset28: Console uses OUR rates for new price analysis

## Behavior

The candidate is based on Console `128a19136ed68df4920c911ad538e7b97df343ac`.
When the server advertises Dataset28 `SupportedVersions=[1,2]` and
`OwnCommercialRatesSupported=true`, new report and catalogue requests use
`PriceAnalysis.Version=2`. The date editor accepts this version and explains
that conversion uses OUR rates, including manually entered values.

Explicit saved V1 settings remain V1. An older server without the capability
retains the previous default; a saved V2 request is rejected against that
server capability. Other special reports retain their existing version checks.
The Console performs no currency calculation and imports no rate history.

Backend integration: `8189363ac`, additive publication migration
`20261001160000_AddOwnPriceAnalysisPublications`. Actual execution still needs
a complete non-FX metadata publication on OUR SQL. This candidate has not been
deployed or verified in an authenticated DEV browser.

## Verification

Private logs: `/private/gba-price28-own-console-20261001/`.

| Check | Result | Log SHA-256 |
| --- | --- | --- |
| Focused request, catalogue and date editor tests | 106/106 | `182af334f26bb438114b013f088fbaef1f8d3feecd33a2cf194331b62ac29b5e` |
| All report tests, eight workers | 3703/3703, zero skips | `942c201d822d4a671460e5ecbad049a387b79574c3932367dd5a042557830662` |
| Production build | Passed | `60b7906e8e70fbddb9424c7fab1b980dd5ab81e2d7b8161c8393a94d050d8a7c` |
| Lint | Passed | `c9d1df8dbf20f1e0e962162ce658e29c4788150ff667ad023ee55cf8ef5319ab` |
| React Doctor, changed scope against the base commit | 93/100, zero errors | `bf96fb2ccd19493762e36a8139f7cc69bb57f013a6c40859fb0a848eba960799` |

The unrestricted whole-application test run passed 6970 tests, failed seven
lazy page loading timeouts and skipped one unrelated test. Its log is retained
with SHA-256 `14445743f4f49139e907046e26433f9efad8c0ccbdff62c8d4de5cd658cc21a6`.
Both affected page files passed 13/13 when rerun with four workers; log
SHA-256 `39ea1648c550ae7486a8d0ace7c257b3dbc5be0e75a99990d4958dbdb1fd99f0`.
The complete report suite then passed with bounded concurrency. No timeout or
production behavior was changed to obtain these results.

Full React Doctor scans of the unchanged base and candidate both scored 68/100
with the same six existing errors and 564 issues. The changed-scope scan found
only two existing component complexity warnings. No suppression was added.
`git diff --check` passed. These checks establish candidate behavior, not live
report acceptance or full 1C parity.
