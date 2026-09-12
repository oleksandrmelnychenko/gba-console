# Exact Fenix filters in the report console

The console preserves, validates, saves, and submits the optional `ProductClassification` and
`SourceOrganizations` contracts for dataset 2 (`NativeSalesNet`). Invalid versions, source worlds,
references, duplicate aliases, duplicate organization references, and native-organization conflicts
are rejected before request I/O.

There is deliberately no editor for these values yet. The dataset capabilities describe only the
wire format and coverage requirements; they do not provide selectable product-kind or organization
identities and captions. Adding free-text identities or local-ID guesses would make the report scope
look configurable without proving the Fenix identity. An editor remains blocked until the server
publishes bounded, authoritative choices containing the exact source identity and its display name.
