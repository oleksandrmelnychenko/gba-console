# Register report components

This module provides controlled React components for register JSON profile v1. It has no router, network client, capture editor, persistence or built-in sample report. The host supplies a descriptor, query draft and decoded statement. Existing report sources 0–16 are independent of this module.

Import components directly from `SourceRegisterReportBuilder` and `SourceRegisterResultTable`. Both require a host-supplied `registerLabel`; that label is presentation only. Use `emptyRegisterQueryDraft()` for new choices or `registerQueryDraft(query, descriptor)` to restore exact periods, axes and caller-selected order. The builder invokes `onChange` with editable query fields and `onSubmit` with the allowlisted query. The host controls loading, access and availability through `busy` and `disabled`.

The host transport must validate original JSON bytes, duplicate/escaped member names, byte/depth limits, trusted schema registry and publication binding before passing decoded objects. The module validates decoded object shapes, schema identity, typed groups, period coverage and exact operands. That structural validation does not authenticate a self-supplied publication reference. The opaque source schema hash is never derived from UI labels or the shortened descriptor DTO.

`serializeRegisterQuery` produces the versioned query only. Facts, completeness, principal policy and publication bindings cannot be submitted through it. Local time controls are formatted as seven-fraction source wall-clock strings without `Date` or timezone conversion. Incomplete draft controls remain editable; invalid periods cannot be submitted.

Numeric operands are canonical `{ coefficient: string, scale: string }` pairs. Formatting inserts a decimal comma textually and retains every digit; it performs no rounding, sums, currency conversion or floating point conversion. The result table displays sparse received groups and the authoritative grand values. Paging changes presentation only. It does not create missing intersections or additional totals. No chart conversion is provided.

Optional `referenceCaptions` maps full `registerAtomIdentity(atom)` to presentation text. Reference type, raw bytes and physical tags remain identity, even when captions match. Technical hashes and IDs appear in audit details; duplicate field captions show the full ID in selection choices to avoid ambiguous truncation.

The codec's `sourceParityVerified: false` remains visible. Source readiness, original ACL equivalence and actual publication availability belong to a separately approved integration. All `*.test-fixtures.ts` and `fixtures/` operands are synthetic test inputs, never live capability defaults.
