# Original matrix in the report editor

Dataset 39 exposes an original matrix panel using the editor's period and one checked product-group selection. The editor can open and edit original full-period saved settings and preserves their request when saving. Actual persistence also requires the backend workspace-only exact original-scope validator: the existing template validation currently shares the current matrix's 366-day bound. That backend change must preserve ordinary current execution limits. The existing current operational matrix keeps its own 366-day execution bound and its existing regional controls. The original panel calls the authenticated original route under the same report-generation permission; it does not submit an ordinary current report as a fallback.

The panel requires `currentVparivanieFullScope: true`, row grouping 5, column groupings 74/75, measurement 83 and exactly one product-group `InGroup` selection. Additional filters/options and unsafe numeric IDs are refused. The normal catalogue resolves the Source reference. Captions, local group IDs and user input are never reinterpreted as that reference.

## Additive API contract

The existing API success envelope and PascalCase result properties remain in use.

`GET /report/originals/vparivanie/group?world=fenix&from=YYYY-MM-DD&through=YYYY-MM-DD&groupId=positiveSafeInteger`

The response contains the existing `MatrixRequest` identity inline, plus:

```ts
{
  GroupCaption: string;
  AdmissionPolicy: 'ExactCurrentInputWitnessV1';
  AcceptedInputWitnessSha256: string | null;
  AcceptanceProofSha256: string | null;
}
```

The backend resolves one current, non-deleted leaf group from normal Own catalogue data. This endpoint does not reread full report history. The optional reviewed deployment acceptance binds the exact world, Source/schema/definition identity, Own database identity, group and period to an accepted normal-input witness and comparison proof. Missing acceptance produces null hashes and the console shows a pending message before requesting report history.

`POST /report/originals/vparivanie/preview` retains the original closed request body, without acceptance fields. The result adds the three admission properties above and `ExactScopeAccepted: boolean`. The backend sets it true only when the actual complete normal read has the accepted scope and input witness. The console verifies the echoed scope, both hashes and current input witness against the group binding. A stale current witness cannot enable table or download.

`SourceParityVerified` and `OriginalFullTaskAccepted` retain their existing overall meaning. Per-scope acceptance does not change either flag or assert that all six reports have passed. A reviewed backend implementing this additive contract and the separately reviewed acceptance deployment are required before activation; a missing endpoint or unsupported response fails closed.

Screen and Excel/CSV use the same completed admitted result. Physical product/column order, duplicate captions, signed decimal strings, explicit zeroes and absent cells remain unchanged. Quantity export retains the existing exact Excel precision rule. Changing settings, caller or permission clears the previous result immediately, cancels in-flight work and prevents late exports.

Focused tests exercise the mounted saved-template path, ordinary current-flow guards, scope/reference/proof binding, permission refusal, changed witnesses, zero/null preservation and asynchronous request/export cancellation. No SQL, Source or live report operator is executed by these tests.
