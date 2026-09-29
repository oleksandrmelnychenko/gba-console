# BUG-1274 Console DEV release, 2026-09-29

The [pinned candidate](bug1274-availability-console-runbook.md) was deployed
to the DEV `gba-console` service only. The old image
`sha256:265ffae9140bb57f485e050df332341d60b45b1e80c7f4113a9a995c1c853b43`
was replaced with
`sha256:2d70db3b68f129644208c7992b20bf71600ce8ea9f8ea30eba06f07e022376ad`
from Console code commit `6a24f837480eb7abf474348d8674cdeecc027eea`.
The exact 36-file Concord Compose chain and both Console config hashes passed
the preflight. `up -d --no-deps --no-build --pull never --wait gba-console`
recreated only Console and returned zero with a healthy container.

`/build.json` returned `2026.09.29.0330`; `/reports/stocks` returned HTTP 200.
An authenticated Chromium check on the live DEV page found one shortcut each
for `Ведомость по денежным средствам.xls` and `Взаємороз всі.xls`, selected
`Кошти: залишки та рух за період` and `Взаєморозрахунки за договором: залишки
та рух`, respectively, and showed the matching account and agreement-family
controls. It observed zero report POSTs and zero page errors. This checked
selection only; it did not generate a report, change OUR SQL or access 1C.

The 1C catalogue's current-only Dataset 10/11 entries remain separate. The
grouped `ДБіторка.xls` form and full workbook parity remain unavailable. The
rollback image and exact overlay are retained in the candidate runbook.
