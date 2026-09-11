# Report constructor workspace

The constructor previously put dataset notes, configuration and analysis controls in one long page. `/reports/constructor` now keeps the dataset, period and Generate action above four sections: report structure, selection conditions, analysis and sorting, and result.

Sections stay mounted so switching between them preserves selections, lookup drafts and analysis settings. The navigation supports arrow keys, Home and End; configuration shortcuts move focus to the destination tab. Readiness and the reason Generate is unavailable remain visible. During generation the inputs are locked, a duplicate submit is rejected, and the result section shows progress. The existing document export dialog opens on success; failure keeps the request available for an explicit retry.

Dataset search is compact. Source limitations remain available in a disclosure. The catalogue opens on demand in the shared AppModal, as do templates and grouping selection. TOP, ABC, threshold, zero suppression and ordering show concise summaries and their applicable prerequisites; the detailed calculation explanations remain accessible. None of these explanations substitutes for server capability or request validation.

Agreement product prices still require a specific validated client agreement. The valuation agreement is distinct from ordinary report filters. Changing sections never supplies an agreement, enables a measure or changes grouping automatically. Existing template/draft compatibility and undo behavior continue to apply.

The screen follows `docs/ui-patterns.md`: flat section navigation, shared cards and modals, neutral secondary actions, and a single row of toolbar controls. On narrow screens the toolbar fields scroll beside the visible Generate button. The existing non-constructor workspace mode remains available to other callers.

Validation on 2026-09-11:

- Report module: 147 suites, 3,350 tests passed. After the final ABC/threshold component extraction, 37 affected tests passed again.
- New workflow coverage includes tab state and focus, TOP/ABC/filter/order request preservation, required agreement, loading, duplicate submission, export result and explicit retry.
- TypeScript build check, targeted ESLint and whitespace checks passed.
- React Doctor 0.9.13: 93 before and after, no errors, the same three pre-existing workspace complexity warnings. The current CLI uses `--scope files --base <commit> --include-untracked` in place of the removed `--diff` flag.
- Browser preview at 1,440, 1,024 and 375 pixels kept Generate and the content inside the viewport. Dataset selection, required agreement, catalogue, templates, TOP/ABC and explicit generation were exercised against dev.

This change does not add SQL kernels or establish numerical parity with 1C. Generalized register publication storage and its previously unavailable endpoint are separate backend work. Release and live download verification are recorded in the private deployment evidence.
