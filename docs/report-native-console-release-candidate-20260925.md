# Native report Console release candidate, 2026-09-25

The isolated worktree `/root/projects/gba-release-worktrees/reports-native-console-20260925`
starts from deployed DEV Console commit `8fbca819bd57c8294f6041f15d6af3d66890729f`.
It adds only `src/features/reports/**` and
`tests/report-catalogue-launch.integration.test.ts` from the current report
implementation. Commit: `6510270e699586dffcaf9282fc4d34ed16cb5159`.
The worktree is clean; the 61 changed files pass `git diff --check`.

Isolated `npm run build` passed. Report tests: 169 files and 3,456 tests
passed; the cross-repository catalogue integration test was run separately
against the isolated server candidate and passed. It covered all 105/105
`native_partial` implementations, 124 launch combinations, 106 configured
variants and 22 unique ready requests. A Docker build from this exact worktree
produced `gba-console:reports-6510270`, image ID
`sha256:8bf83ac3bfb141bdbfd72cec7fd96b9d3ac3aa03a4ca7130daa8b60c90cc4de3`,
with exact `gba.git.sha` label. This image was deployed to DEV with the
matching `data-analytics` candidate. The authenticated dataset endpoint
returned 35 datasets; source 35 exact Goods/Buyers/organization preview
returned one row and ten columns, and signed XLSX/PDF downloads succeeded.
Source 38 refused the incomplete whole day with HTTP 400.
A separately certified source-36 product and period returned one row and
three quantity columns through the same authenticated preview route.

This candidate includes native Console adapters for partial GBA report sources
29–32, 35, 36 and 38. Source 38 must continue to refuse the incomplete whole day;
historical cash and settlement XLS variants remain unavailable.
