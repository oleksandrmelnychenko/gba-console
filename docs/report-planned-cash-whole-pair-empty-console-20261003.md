# Planned cash: verified empty opening transport

Calendar receipts, calendar payouts and net flow accept an optional
`WholePhysicalPairEmptyVerified: true` on their own Receipts or Requests proof.
The server derives this marker from the corresponding completed opening
publication and retained proof of absence in both physical tables across the
full SQL datetime domain. The console validates the delivery contract; it does
not inspect source tables or calculate financial values.

An available planned balance requires complete publication and exactly one
opening mode: dated opening or verified whole-pair empty opening. Current,
previous and scenario turnover reject the empty-opening marker. A present
marker must be `true`; the server omits its default `false` value. Existing
deliveries without the marker remain supported.

A verified opening may accompany an unavailable balance when later required
movement months are missing. The marker supplies no credit for those months.
Later genuine movements and their server-authored values remain valid after an
empty opening. Each net-flow relation requires its own proof.

Confirmed empty results retain no rows and available NULL amounts. Missing
input retains unavailable NULL amounts. The console creates neither synthetic
groups nor zero values.

Focused verification covers all planned-cash forms, both net-flow relations,
empty and later nonempty deliveries, partial month publication, simultaneous
opening modes, malformed markers, turnover misuse and incomplete publication.
Live browser acceptance, deployment, source population proof and whole-task
acceptance require separate evidence.
