import { useI18n } from '../../../../shared/i18n/useI18n'
import { SaleAuditDetail } from '../../../../shared/sale-audit/SaleAuditDetail'
import {
  confirmSalesUkraineSaleAuditHistory,
  getSalesUkraineSaleAuditInvoiceDocument,
  getSalesUkraineSaleAuditShiftedDocument,
} from '../../../../shared/sale-audit/saleAuditApi'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { DocumentExportModal } from '../../../../shared/ui/document-export-modal/DocumentExportModal'
import {
  getSaleById, getSalesUkraineCurrentUnmergedSale, createSalesUkraineMergedSale,
  getSalesUkraineDeliveryDetails, getSalesUkraineMergedDetails,
} from '../../api/salesUkraineApi'
import { MergedSalesDrawer } from '../MergedSalesDrawer'
import { SaleDetailsDrawer } from '../SaleDetailsDrawer'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { WizardOrderedProductsDrawer } from './WizardOrderedProductsDrawer'
import type { WizardSalesRegisterActions } from './useWizardSalesRegisterActions'

const SALES_UKRAINE_AUDIT_DOCUMENT_API = {
  confirm: confirmSalesUkraineSaleAuditHistory,
  getInvoice: getSalesUkraineSaleAuditInvoiceDocument,
  getShifted: getSalesUkraineSaleAuditShiftedDocument,
}

export function WizardSalesRegisterOverlays({
  actions, clientNetId, canEdit, canConvertMergedToBill, permissionScopedSalesUkraineApi,
}: {
  actions: WizardSalesRegisterActions
  clientNetId: string | null
  canEdit: boolean
  canConvertMergedToBill: boolean
  permissionScopedSalesUkraineApi: boolean
}) {
  const { t } = useI18n()
  return (
    <>
      <WizardOrderedProductsDrawer
        clientNetId={clientNetId}
        opened={actions.isOrderedProductsOpen}
        onClose={actions.closeOrderedProducts}
      />

      <SaleEditDrawer sale={actions.editShiftSale} onClose={actions.closeEdit} onSaved={actions.handleShiftSaved} />

      <AppDrawer
        opened={Boolean(actions.auditSale)}
        position="right"
        size="min(720px, 100vw)"
        title={t('Рух товарно-матеріальних цінностей')}
        onClose={actions.closeAudit}
      >
        <SaleAuditDetail
          documentNumber={actions.auditSale?.SaleNumber?.Value}
          documentApi={permissionScopedSalesUkraineApi ? SALES_UKRAINE_AUDIT_DOCUMENT_API : undefined}
          error={actions.auditError}
          isLoading={actions.isAuditLoading}
          showConfirm={canEdit}
          statistic={actions.auditStatistic}
        />
      </AppDrawer>

      <SaleDetailsDrawer
        canEdit={canEdit}
        loadSale={permissionScopedSalesUkraineApi ? getSalesUkraineDeliveryDetails : getSaleById}
        sale={actions.detailsSale}
        onClose={actions.closeDetails}
        onSaved={actions.handleDetailsSaved}
      />

      <MergedSalesDrawer
        canCreateInvoice={canConvertMergedToBill}
        canEdit={canEdit}
        clientAgreementNetId={actions.mergedSale?.ClientAgreement?.NetUid ?? null}
        loadCurrentUnmergedSale={permissionScopedSalesUkraineApi
          ? getSalesUkraineCurrentUnmergedSale
          : undefined}
        loadMergedSale={permissionScopedSalesUkraineApi ? getSalesUkraineMergedDetails : undefined}
        saleNetId={actions.mergedSale?.NetUid ?? null}
        onChanged={actions.handleMergedChanged}
        onClose={actions.closeMerged}
        onCreateNewSale={actions.handleMergedNewSale}
        onEditSale={actions.handleMergedEdit}
        onInvoice={actions.handleMergedInvoice}
        submitMergedSale={permissionScopedSalesUkraineApi ? createSalesUkraineMergedSale : undefined}
      />

      <DocumentExportModal
        excelUrl={actions.printState?.document?.excelUrl}
        isLoading={Boolean(actions.printState?.isLoading)}
        opened={Boolean(actions.printState)}
        pdfUrl={actions.printState?.document?.pdfUrl}
        title={t('Документ продажу')}
        onClose={actions.closePrint}
      />
    </>
  )
}
