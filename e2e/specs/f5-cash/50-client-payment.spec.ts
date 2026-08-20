import { expect, test } from '../../fixtures/test';
import { createClientPayment } from '../../flows/payments';

test.describe.configure({ mode: 'serial' });

const PAYMENT_AMOUNT = 1;

interface PaymentCandidate {
  AgreementCurrencyID: number;
  AgreementCurrencyNetUid: string;
  ClientAgreementAmountBefore: number;
  ClientAgreementID: number;
  ClientAgreementNetUid: string;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  DebtID: number;
  DebtTotalBefore: number;
  PaymentCurrencyRegisterID: number;
  PaymentRegisterAmountBefore: number;
  PaymentRegisterID: number;
  RegisterCurrencyID: number;
  RegisterCurrencyNetUid: string;
  SaleID: number;
  SaleNetUid: string;
  SaleNumber: string;
}

interface PaymentProjection {
  AgreementAmount: number;
  AgreementCurrencyID: number;
  AgreementExchangedAmount: number;
  AllocationCount: number;
  AllocationSum: number;
  ClientAgreementAmount: number;
  ClientAgreementID: number;
  ClientID: number;
  DebtTotal: number;
  DocumentCurrencyID: number;
  DocumentToAgreementRate: number;
  EffectiveInputAmount: number;
  EuroAmount: number;
  FxSnapshotCount: number;
  HasIncomeSaleAllocations: boolean;
  IncomePaymentOrderNetUid: string;
  IncomeDocumentCurrencyID: number;
  MovementCount: number;
  MutationCompleted: boolean;
  OperationKind: string;
  PaymentAmount: number;
  PaymentCurrencyRegisterID: number;
  PaymentRegisterAmount: number;
  PaymentRegisterID: number;
  PersistedDocumentAmount: number;
  RegisterCurrencyID: number;
  ResolutionStatus: string;
  ResultEntityKind: string;
  SaleAllocationCount: number;
}

test('каса/FX: точний борг, рахунок, ledger і verified FX-знімок змінюються атомарно @smoke', async ({ page, db, entities }) => {
  const candidates = await db.query<PaymentCandidate>(
    `SELECT TOP 1
       client.ID AS ClientID,
       client.FullName AS ClientName,
       LOWER(CONVERT(varchar(36), client.NetUID)) AS ClientNetUid,
       clientAgreement.ID AS ClientAgreementID,
       LOWER(CONVERT(varchar(36), clientAgreement.NetUID)) AS ClientAgreementNetUid,
       clientAgreement.CurrentAmount AS ClientAgreementAmountBefore,
       agreementCurrency.ID AS AgreementCurrencyID,
       LOWER(CONVERT(varchar(36), agreementCurrency.NetUID)) AS AgreementCurrencyNetUid,
       paymentRegister.ID AS PaymentRegisterID,
       paymentCurrencyRegister.ID AS PaymentCurrencyRegisterID,
       paymentCurrencyRegister.Amount AS PaymentRegisterAmountBefore,
       registerCurrency.ID AS RegisterCurrencyID,
       LOWER(CONVERT(varchar(36), registerCurrency.NetUID)) AS RegisterCurrencyNetUid,
       debt.ID AS DebtID,
       debt.Total AS DebtTotalBefore,
       sale.ID AS SaleID,
       LOWER(CONVERT(varchar(36), sale.NetUID)) AS SaleNetUid,
       saleNumber.Value AS SaleNumber
     FROM dbo.ClientInDebt clientInDebt
     JOIN dbo.Debt debt
       ON debt.ID = clientInDebt.DebtID
      AND debt.Deleted = 0
      AND debt.Total > @amount
     JOIN dbo.Client client
       ON client.ID = clientInDebt.ClientID
      AND client.Deleted = 0
     JOIN dbo.Agreement agreement
       ON agreement.ID = clientInDebt.AgreementID
      AND agreement.Deleted = 0
      AND agreement.IsDefaultForSyncConsignment = 0
     JOIN dbo.ClientAgreement clientAgreement
       ON clientAgreement.AgreementID = agreement.ID
      AND clientAgreement.ClientID = client.ID
      AND clientAgreement.Deleted = 0
     JOIN dbo.Currency agreementCurrency
       ON agreementCurrency.ID = agreement.CurrencyID
      AND agreementCurrency.Code = N'EUR'
     JOIN dbo.PaymentRegister paymentRegister
       ON paymentRegister.OrganizationID = agreement.OrganizationID
      AND paymentRegister.Deleted = 0
      AND paymentRegister.IsActive = 1
      AND paymentRegister.Type = 2
     JOIN dbo.PaymentCurrencyRegister paymentCurrencyRegister
       ON paymentCurrencyRegister.PaymentRegisterID = paymentRegister.ID
      AND paymentCurrencyRegister.Deleted = 0
      AND paymentCurrencyRegister.Amount >= @amount
     JOIN dbo.Currency registerCurrency
       ON registerCurrency.ID = paymentCurrencyRegister.CurrencyID
      AND registerCurrency.Code = N'UAH'
     JOIN dbo.Sale sale
       ON sale.ID = clientInDebt.SaleID
      AND sale.Deleted = 0
      AND sale.ClientAgreementID = clientAgreement.ID
     JOIN dbo.SaleNumber saleNumber
       ON saleNumber.ID = sale.SaleNumberID
     WHERE clientInDebt.Deleted = 0
       AND client.FullName IS NOT NULL
       AND LEN(client.FullName) BETWEEN 6 AND 100
       AND (SELECT COUNT(*) FROM dbo.Client duplicate
            WHERE duplicate.Deleted = 0
              AND duplicate.FullName = client.FullName) = 1
       AND (SELECT COUNT(*)
            FROM dbo.ClientInDebt otherDebt
            JOIN dbo.Debt otherDebtValue
              ON otherDebtValue.ID = otherDebt.DebtID
             AND otherDebtValue.Deleted = 0
             AND otherDebtValue.Total > 0
            WHERE otherDebt.ClientID = client.ID
              AND otherDebt.Deleted = 0) = 1
     ORDER BY clientInDebt.ID DESC`,
    { amount: PAYMENT_AMOUNT },
  );
  expect(candidates, 'знайдено один EUR-борг і активний UAH-рахунок').toHaveLength(1);
  const candidate = candidates[0];

  const created = await createClientPayment(page, {
    agreementCurrencyNetUid: candidate.AgreementCurrencyNetUid,
    amount: PAYMENT_AMOUNT,
    clientAgreementNetUid: candidate.ClientAgreementNetUid,
    clientName: candidate.ClientName,
    clientNetUid: candidate.ClientNetUid,
    clientSearchValue: candidate.ClientName,
    registerCurrencyNetUid: candidate.RegisterCurrencyNetUid,
    saleNetUid: candidate.SaleNetUid,
    saleNumber: candidate.SaleNumber,
  });

  const projection = await db.poll<PaymentProjection>(
    `SELECT
       operation.OperationKind,
       operation.IsCompleted AS MutationCompleted,
       operation.ResultEntityKind,
       LOWER(CONVERT(varchar(36), income.NetUID)) AS IncomePaymentOrderNetUid,
       income.Amount AS PaymentAmount,
       income.ClientID,
       income.ClientAgreementID,
       income.PaymentRegisterID,
       income.CurrencyID AS IncomeDocumentCurrencyID,
       income.AgreementExchangedAmount,
       income.EuroAmount,
       (SELECT COUNT(*) FROM dbo.IncomePaymentOrderSale allocation
        WHERE allocation.IncomePaymentOrderID = income.ID
          AND allocation.Deleted = 0) AS AllocationCount,
       COALESCE((SELECT SUM(allocation.Amount) FROM dbo.IncomePaymentOrderSale allocation
        WHERE allocation.IncomePaymentOrderID = income.ID
          AND allocation.Deleted = 0), 0) AS AllocationSum,
       (SELECT COUNT(*) FROM dbo.IncomePaymentOrderSale allocation
        WHERE allocation.IncomePaymentOrderID = income.ID
          AND allocation.Deleted = 0
          AND allocation.SaleID = @saleId) AS SaleAllocationCount,
       (SELECT COUNT(*) FROM dbo.PaymentMovementOperation movement
        WHERE movement.IncomePaymentOrderID = income.ID
          AND movement.Deleted = 0) AS MovementCount,
       (SELECT COUNT(*) FROM dbo.PaymentOrderFxSnapshot snapshotCount
        WHERE snapshotCount.OperationNetUid = operation.OperationNetUid
          AND snapshotCount.IsDeleted = 0) AS FxSnapshotCount,
       snapshot.PaymentCurrencyRegisterID,
       snapshot.RegisterCurrencyID,
       snapshot.DocumentCurrencyID,
       snapshot.AgreementCurrencyID,
       snapshot.HasIncomeSaleAllocations,
       snapshot.PersistedDocumentAmount,
       snapshot.EffectiveInputAmount,
       snapshot.AgreementAmount,
       snapshot.DocumentToAgreementRate,
       snapshot.ResolutionStatus,
       paymentCurrencyRegister.Amount AS PaymentRegisterAmount,
       debt.Total AS DebtTotal,
       clientAgreement.CurrentAmount AS ClientAgreementAmount
     FROM dbo.AccountingMutationOperation operation
     JOIN dbo.IncomePaymentOrder income
       ON income.ID = operation.ResultEntityID
      AND income.Deleted = 0
     JOIN dbo.PaymentOrderFxSnapshot snapshot
       ON snapshot.OperationNetUid = operation.OperationNetUid
      AND snapshot.IncomePaymentOrderID = income.ID
      AND snapshot.IsDeleted = 0
     JOIN dbo.PaymentCurrencyRegister paymentCurrencyRegister
       ON paymentCurrencyRegister.ID = @paymentCurrencyRegisterId
     JOIN dbo.Debt debt
       ON debt.ID = @debtId
     JOIN dbo.ClientAgreement clientAgreement
       ON clientAgreement.ID = @clientAgreementId
     WHERE operation.OperationNetUid = @operationNetUid`,
    (rows) => rows.length === 1 &&
      Boolean(rows[0].MutationCompleted) &&
      rows[0].AllocationCount === 1 &&
      rows[0].FxSnapshotCount === 1,
    { timeoutMs: 60_000, label: 'exact accounting mutation and FX snapshot' },
    {
      clientAgreementId: candidate.ClientAgreementID,
      debtId: candidate.DebtID,
      operationNetUid: created.operationNetUid,
      paymentCurrencyRegisterId: candidate.PaymentCurrencyRegisterID,
      saleId: candidate.SaleID,
    },
  );
  const result = projection[0];

  expect(result.OperationKind).toBe('income-payment:add');
  expect(result.ResultEntityKind).toBe('IncomePaymentOrder');
  expect(result.IncomePaymentOrderNetUid).toBe(created.incomePaymentOrderNetUid);
  expect(result.ClientID).toBe(candidate.ClientID);
  expect(result.ClientAgreementID).toBe(candidate.ClientAgreementID);
  expect(result.PaymentRegisterID).toBe(candidate.PaymentRegisterID);
  expect(result.PaymentCurrencyRegisterID).toBe(candidate.PaymentCurrencyRegisterID);
  expect(result.IncomeDocumentCurrencyID).toBe(candidate.RegisterCurrencyID);
  expect(result.PaymentAmount).toBe(PAYMENT_AMOUNT);
  expect(result.MovementCount).toBe(1);
  expect(result.SaleAllocationCount).toBe(1);
  expect(result.AllocationSum).toBeGreaterThan(0);
  expect(result.AllocationSum).toBeLessThan(candidate.DebtTotalBefore);
  expect(result.DebtTotal).toBeCloseTo(candidate.DebtTotalBefore - result.AllocationSum, 4);
  expect(result.PaymentRegisterAmount).toBeCloseTo(candidate.PaymentRegisterAmountBefore + PAYMENT_AMOUNT, 4);
  expect(result.ClientAgreementAmount).toBe(candidate.ClientAgreementAmountBefore);

  expect(result.RegisterCurrencyID).toBe(candidate.RegisterCurrencyID);
  expect(result.DocumentCurrencyID).toBe(candidate.RegisterCurrencyID);
  expect(result.AgreementCurrencyID).toBe(candidate.AgreementCurrencyID);
  expect(Boolean(result.HasIncomeSaleAllocations)).toBe(true);
  expect(result.ResolutionStatus.toLowerCase()).toBe('verified');
  expect(result.PersistedDocumentAmount).toBe(PAYMENT_AMOUNT);
  expect(result.EffectiveInputAmount).toBe(PAYMENT_AMOUNT);
  expect(result.AgreementAmount).toBeGreaterThan(0);
  expect(result.DocumentToAgreementRate).toBeGreaterThan(0);
  expect(result.AgreementExchangedAmount).toBeCloseTo(result.AgreementAmount, 4);
  expect(result.EuroAmount).toBeCloseTo(result.AgreementAmount, 4);

  entities.record('cash.client-payment.fx', {
    arrivalNumber: created.arrivalNumber,
    clientId: candidate.ClientID,
    incomePaymentOrderNetUid: created.incomePaymentOrderNetUid,
    operationNetUid: created.operationNetUid,
    saleId: candidate.SaleID,
  });
});
