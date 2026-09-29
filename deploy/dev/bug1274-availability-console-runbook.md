# BUG-1274 Console DEV candidate, 2026-09-29

This changes only the DEV `gba-console` container. It exposes two bounded,
capability-checked workbook shortcuts for native Datasets 40 and 41. It does
not promote the captured 1C constructor sources or complete either workbook.
No 1C or SQL access, migration, sync, or Docker deployment was performed while
preparing this candidate.

| Pin | Value |
| --- | --- |
| Console code | `6a24f837480eb7abf474348d8674cdeecc027eea`, one commit after live `b6c1ca6155f0aa42feacba0f02fe3415550714a9` |
| Candidate image | `gba-console:bug1274-availability-6a24f837` = `sha256:2d70db3b68f129644208c7992b20bf71600ce8ea9f8ea30eba06f07e022376ad` |
| Live rollback image | `gba-console:supplier38-product-b6c1ca6` = `sha256:265ffae9140bb57f485e050df332341d60b45b1e80c7f4113a9a995c1c853b43` |
| Current Concord Compose chain | 36 files: 34 original, `/private/gba-sync-identity-dev-candidate-20260929/quiesce-current.compose.yml`, then `/private/gba-sync-identity-dev-candidate-20260929/candidate.compose.yml`. SHA-256 of the paths joined with `\n` and **no final newline**: `45b3bce3f981941e4581a47a99e442e8bf4a297fbc1d1666b3b75488174998cb` |
| Live / rollback Console config hash | `3af13ce61ec08fb28248ad76d30e9bb505e7604e3e7ad97380b355e931c74c05` |
| Candidate Console config hash | `33f491e6301b802d83f499b88e490c0e0e30a0be56f651de6424dae4767b0c21` |

The image was built locally with `VITE_API_BASE_URL=/` and
`VITE_API_LANGUAGE=uk`; `npm run build` passed. Four focused Console test
files passed 70/70. The existing wider report suite had passed 3,666 tests
with one fixture-dependent test skipped at the code commit. Current live
Console is healthy; `/build.json` returns `2026.09.28.2018` and
`/reports/stocks` returns 200.

## Pinned preflight

Run from a Bash shell. Abort if any assertion fails or if Concord's chain or
the live Console changed. The service comparison of the rendered 36-file
chain with the candidate overlay found exactly one changed service,
`gba-console`; its changed keys are `build`, `image`, and `labels`. All eight
sibling service configs and top-level config are equal. Console environment,
ports, mounts, healthcheck, dependencies, networks, and restart policy are
equal. The rollback overlay recreates the live Console config hash exactly.

```bash
set -euo pipefail
cd /root/projects/gba-infra
chain_json=$(docker inspect gba-dev-data-concord-1 --format '{{json .Config.Labels}}')
chain_paths=$(printf '%s' "$chain_json" | python3 -c '
import hashlib,json,pathlib,sys
p=json.load(sys.stdin)["com.docker.compose.project.config_files"].split(",")
assert len(p)==36 and all(pathlib.Path(x).is_file() for x in p)
assert p[-2].endswith("/quiesce-current.compose.yml") and p[-1].endswith("/candidate.compose.yml")
assert hashlib.sha256("\n".join(p).encode()).hexdigest()=="45b3bce3f981941e4581a47a99e442e8bf4a297fbc1d1666b3b75488174998cb"
print("\n".join(p))')
mapfile -t files <<< "$chain_paths"
compose=(docker compose -p gba-dev --env-file /root/projects/gba-infra/.env.dev)
for file in "${files[@]}"; do compose+=(-f "$file"); done
candidate=/root/projects/gba-release-worktrees/console-report-availability-20260929/deploy/dev/bug1274-availability-console.compose.yml
rollback=/root/projects/gba-release-worktrees/console-report-availability-20260929/deploy/dev/bug1274-availability-console-rollback.compose.yml
test "$(docker inspect gba-dev-gba-console-1 --format '{{.Image}}')" = sha256:265ffae9140bb57f485e050df332341d60b45b1e80c7f4113a9a995c1c853b43
test "$(docker image inspect gba-console:bug1274-availability-6a24f837 --format '{{.Id}}')" = sha256:2d70db3b68f129644208c7992b20bf71600ce8ea9f8ea30eba06f07e022376ad
test "$("${compose[@]}" -f "$rollback" config --hash gba-console)" = 'gba-console 3af13ce61ec08fb28248ad76d30e9bb505e7604e3e7ad97380b355e931c74c05'
test "$("${compose[@]}" -f "$candidate" config --hash gba-console)" = 'gba-console 33f491e6301b802d83f499b88e490c0e0e30a0be56f651de6424dae4767b0c21'
```

Do **not** run a stack-wide `up`: the 36-file Concord chain is narrower than
the file list on some currently running sibling containers. Use `--no-deps`
and name only `gba-console`.

## Switch and read-only smoke

The integration owner may perform this after pinned preflight. It recreates
only the Console container from the already built local image.

```bash
"${compose[@]}" -f "$candidate" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 gba-console
test "$(docker inspect gba-dev-gba-console-1 --format '{{.Image}}')" = sha256:2d70db3b68f129644208c7992b20bf71600ce8ea9f8ea30eba06f07e022376ad
test "$(docker inspect gba-dev-gba-console-1 --format '{{.State.Health.Status}}')" = healthy
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8083/build.json
curl --fail --silent --show-error --max-time 5 -o /dev/null http://127.0.0.1:8083/reports/stocks
```

In an existing authorized Console session, open `/reports/stocks` and inspect
the workbook shortcuts without generating a report. With unique compatible
live Dataset 40 and 41 capabilities, the screen should show `Рух коштів за
період` and `Взаєморозрахунки за період`; each requires an exact account or
agreement before use. Without those capabilities, the shortcut must remain
hidden. The old Dataset 10/11 catalogue entries still describe current state,
and the captured custom 1C constructors have no launch. Check for missing
assets or Console errors. This smoke reads only existing API data.

## Rollback

If the new Console health or screen contract fails, use the same pinned chain
and the rollback overlay. The old image is already local.

```bash
"${compose[@]}" -f "$rollback" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 gba-console
test "$(docker inspect gba-dev-gba-console-1 --format '{{.Image}}')" = sha256:265ffae9140bb57f485e050df332341d60b45b1e80c7f4113a9a995c1c853b43
test "$(docker inspect gba-dev-gba-console-1 --format '{{.Config.Labels}}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["com.docker.compose.config-hash"])')" = 3af13ce61ec08fb28248ad76d30e9bb505e7604e3e7ad97380b355e931c74c05
```
