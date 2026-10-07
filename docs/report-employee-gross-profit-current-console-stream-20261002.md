# Employee Console captured-caller stream successor

This isolated successor preserves the committed first Console patch
`54f3f1c44e236a67a738a1dd8c509e00089e9169` and its immutable review.
The source identity, fixed ActiveRecordsOnly policy, Month-only request,
four server cells, explicit management unit and backend8390 wire shape remain
unchanged. The product note now explains active history at each endpoint in
plain language. No financial number is calculated or rounded in the browser.

The first API used generic `apiRequest`, which can retry a401 after an auth
refresh without guaranteeing that its caller stayed the same. This successor
uses the existing accepted `apiStreamClient` unchanged. Caller/CSRF generation
is captured from the actual stored session before HTTP; another caller is
refused. Same-caller401 refresh retains identical command bytes. Caller changes
before response, during refresh or during body drain abort the old operation
and preserve any new session rather than exposing old files or retrying as
the new caller. Refused/ambiguous403/409/503 previews are not retried.

JSON is drained through the existing capped stream pattern with a16MiB ceiling,
fatal UTF8 decoding and request/session/abort checks before and after each read.
The fully validated scalar body must match both report hash headers before
inline cells or caller-signed file links are returned. Panel/catalogue calls
pass their actual caller key and AbortSignal; all previous run-scope cleanup,
month/permission isolation and known-empty/unknown semantics stay in place.

Shared `apiStreamClient`, generic API client, session implementation, package
and lock bytes are unchanged. No shared serializer, producer flag, schema,
Source profile or workspace wiring is altered. The original25 declared Console
cases remain historical; replacing its3 basic API cases with13 real-stream
cases gives35 current declared cases. New cases cover cookies/CSRF/caller,
same-caller401 refresh, a caller switch during401 refresh, both mismatched hash
headers, refused statuses, deferred caller response, session changes during
drain and cancellation without partial data/files.

The author performed FILE/Git work only. Tests, lint, build, Doctor, browser,
runtime, Source/OUR SQL and deployment were not executed. Root owns actual
acceptance and integration; numeric data/native parity/current browser claims
are not supplied by this transport fix.
