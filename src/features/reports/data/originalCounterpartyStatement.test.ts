import { expect, it } from 'vitest'
import { emptyStatement, missingStatement, statementAgreement, statementCapability, statementOrg, statementParty, statementResponse } from '../testing/counterpartyStatementFixtures'
import { isStatementCapability, normalizeStatement, statementPeriodError, statementRequest } from './originalCounterpartyStatement'
import { statementCsv, statementHeaders, statementMatrix, statementPdfDefinition, statementValues } from './originalCounterpartyStatementExport'
it('own original default keeps three hierarchy levels and all eight resource-major measures', () => {
  expect(isStatementCapability(statementCapability)).toBe(true)
  for (const patch of [{ World: 'amg' }, { DefaultMeasures: statementCapability.DefaultMeasures.slice(1) }, { DefaultRows: ['Организация', 'Контрагент'] }, { SourceParityVerified: true }])
    expect(isStatementCapability({ ...statementCapability, ...patch })).toBe(false)
})
it('explicit inclusive dates and all three canonical equality filters are copied without timestamp or native-default guesses', () => {
  const r = statementRequest(statementCapability, '2026-09-10', '2026-09-12', [statementOrg], [statementParty], [statementAgreement])
  expect(r).toMatchObject({ Organizations: [statementOrg], Counterparties: [statementParty], Agreements: [statementAgreement] })
  for (const dates of [['2026-02-30', '2026-03-01'], ['2026-09-12', '2026-09-10'], ['2026-09-10', '2027-09-10'], ['2026-09-10T00:00:00Z', '2026-09-12']]) expect(statementPeriodError(dates[0], dates[1])).not.toBeNull()
  expect(statementPeriodError('2024-02-29', '2025-02-27')).toBeNull(); expect(statementPeriodError('2024-02-29', '2025-02-28')).not.toBeNull()
  expect(() => statementRequest(statementCapability, r.From, r.Through, [], [], [statementAgreement, statementAgreement])).toThrow()
})
it('signed incoming and outgoing conserve closing independently in both resource vectors', () => {
  const r = statementResponse(), request = statementRequest(statementCapability, r.From, r.Through)
  expect(normalizeStatement(r, request).Totals?.Management.Outgoing).toBe('-1.00')
  for (const resource of ['Settlement', 'Management'] as const) {
    const bad = statementResponse(); bad.Rows[0].Counterparties[0].Agreements[0].Amounts[resource].Closing = '999.00'
    expect(() => normalizeStatement(bad, request)).toThrow()
  }
})
it('all three nested totals must match the complete agreement rows rather than a float approximation', () => {
  const r = statementResponse(), request = statementRequest(statementCapability, r.From, r.Through)
  r.Totals!.Settlement = { Opening: '99999999999999999999.00', Incoming: '0.00', Outgoing: '0.00', Closing: '99999999999999999999.00' }
  expect(() => normalizeStatement(r, request)).toThrow()
  r.Rows[0].Amounts = structuredClone(r.Totals!); r.Rows[0].Counterparties[0].Amounts = structuredClone(r.Totals!); r.Rows[0].Counterparties[0].Agreements[0].Amounts = structuredClone(r.Totals!)
  expect(normalizeStatement(r, request).Totals).toEqual(r.Totals)
})
it('same-time complete empty and missing responses must echo every selected organization party and agreement', () => {
  const request = statementRequest(statementCapability, '2026-09-10', '2026-09-12', [statementOrg], [statementParty], [statementAgreement])
  for (const base of [statementResponse(), emptyStatement(), missingStatement()]) {
    const r = { ...base, Organizations: [...request.Organizations], Counterparties: [...request.Counterparties], Agreements: [...request.Agreements] }
    expect(normalizeStatement(r, request)).toEqual(r)
    for (const field of ['Organizations', 'Counterparties', 'Agreements']) for (const forged of [[], undefined, ['F'.repeat(32)]])
      expect(() => normalizeStatement({ ...r, [field]: forged }, request)).toThrow()
  }
})
it('a foreign agreement row is refused even if selected-filter echoes and every total were forged consistently', () => {
  const r = statementResponse(), request = statementRequest(statementCapability, r.From, r.Through, [statementOrg], [statementParty], [statementAgreement])
  r.Organizations = request.Organizations; r.Counterparties = request.Counterparties; r.Agreements = request.Agreements
  r.Rows[0].Counterparties[0].Agreements[0].Agreement = 'F'.repeat(32)
  expect(() => normalizeStatement(r, request)).toThrow()
})
it('missing normal input carries no partial rows totals choices or digest and names the exact family month', () => {
  const r = missingStatement(), request = statementRequest(statementCapability, r.From, r.Through)
  expect(normalizeStatement(r, request).Dependency?.MovementRegister).toBe(2)
  expect(() => normalizeStatement({ ...r, Rows: statementResponse().Rows }, request)).toThrow()
  expect(() => normalizeStatement({ ...r, Totals: emptyStatement().Totals }, request)).toThrow()
})
it('unknown human captions retain their keys signed resources and export row without raw-key labels', () => {
  const r = statementResponse(); r.Rows[0].Counterparties[0].Agreements[0].Caption = 'Назва договору недоступна'; r.Rows[0].Counterparties[0].Agreements[0].CaptionAvailable = false
  r.AgreementChoices = []; r.MissingCaptionMappings = ['Agreement']
  expect(normalizeStatement(r, statementRequest(statementCapability, r.From, r.Through)).Rows).toHaveLength(1)
  expect(statementMatrix(r)[3]).toContain('Назва договору недоступна'); expect(statementMatrix(r)[3]).not.toContain(statementAgreement)
})
it('one full hierarchy matrix feeds screen CSV XLSX source and PDF with all eight resource cells', () => {
  const r = statementResponse(), matrix = statementMatrix(r)
  expect(matrix[0]).toEqual(statementHeaders); expect(matrix[0]).toHaveLength(11); expect(matrix).toHaveLength(5)
  expect(matrix.at(-1)).toEqual(['Разом', '', '', ...statementValues(r.Totals!)])
  expect(statementPdfDefinition(r).content).toContainEqual(expect.objectContaining({ table: expect.objectContaining({ body: matrix, widths: Array(11).fill('*') }) }))
  expect(statementCsv(r)).toContain(r.ResultSha256); expect(statementCsv(r)).toContain('"-1.00"')
})
it('formula-like human captions are escaped only in label columns and exact signed amounts remain unchanged', () => {
  const r = statementResponse(); r.Rows[0].Counterparties[0].Agreements[0].Caption = '=unsafe'
  expect(statementCsv(r)).toContain(`"'=unsafe"`); expect(statementCsv(r)).toContain('"-2.00"')
})
