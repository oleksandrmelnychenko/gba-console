import { Box, Stack, Text } from '@mantine/core'
import { UserSearch } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientFolderChildren } from '../../../clients/clientFolder'
import type { Client, ClientAgreement } from '../../../clients/types'
import type { SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'
import { WizardClientAgreementsStrip } from './WizardClientAgreementsStrip'
import { WizardClientCarousel } from './WizardClientCarousel'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'
import { WizardClientRegistry } from './WizardClientRegistry'
import { isWizardSaleClientSelectable } from './wizardClientStepModel'
import type { WizardSalesPermissionFlow } from './wizardSaleHeaderApi'
import { useWizardClientCarousel } from './useWizardClientCarousel'
import { useWizardClientKeyboard } from './useWizardClientKeyboard'

import { useWizardClientSelection } from './useWizardClientSelection'
import { useWizardClientSearch } from './useWizardClientSearch'
import { useWizardClientSalesRegister } from './useWizardClientSalesRegister'

import { useWizardSalesRegisterActions } from './useWizardSalesRegisterActions'
import { WizardSalesRegisterOverlays } from './WizardSalesRegisterOverlays'

export function NewSaleClientStep({
  canConvertMergedToBill = false,
  canEdit = true,
  canOpenDeliveryDetails = true,
  canOpenDetails = true,
  canViewAudit = true,
  clientNetId,
  headerClose,
  headerTools,
  initialClient,
  onClientChange,
  onClientResolved,
  onAgreementChange,
  onOpenSale,
  onCreateMergedMainClientSale,
  onEditMergedSale,
  onInvoiceMergedSale,
  onRequestClose,
  permissionFlow = 'create',
  permissionScopedSalesUkraineApi = false,
}: {
  canConvertMergedToBill?: boolean
  canEdit?: boolean
  canOpenDeliveryDetails?: boolean
  canOpenDetails?: boolean
  canViewAudit?: boolean
  clientNetId: string | null
  headerClose?: ReactNode
  headerTools?: ReactNode
  initialClient?: Client | null
  onAgreementChange: (agreementNetId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  onClientChange: (clientNetId: string | null) => void
  onClientResolved?: (client: Client | null) => void
  onCreateMergedMainClientSale?: (unionSale: SalesUkraineSale) => void
  onEditMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  onInvoiceMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  onOpenSale: (sale: SalesUkraineSale) => void | Promise<unknown>
  onRequestClose?: () => void
  permissionFlow?: WizardSalesPermissionFlow
  permissionScopedSalesUkraineApi?: boolean
}) {
  const { t } = useI18n()
  const navigation = useWizardClientCarousel({
    confirmClient: (client, options) => confirmClient(client, options),
    unselectClient: () => unselectClient(),
    loadMore: () => runVirtualLoad(),
  })
  const { carousel, searchInputRef, pickClient, cancelPendingMove } = navigation
  const {
    registryItems, isRegistryLoading, statusFilter, saleSearch, dateFrom, dateTo,
    resetRegister, fetchRegister, refreshAfterSave, handleStatusChange, handleSaleSearchChange,
    handleDateFromChange, handleDateToChange, replaceRegistryRow, refreshRegistryRow,
  } = useWizardClientSalesRegister()
  const {
    selectedClient, groupedDebts, identityAttention, agreements, agreementsLoading, selectedAgreementKey, selectedAgreement,
    confirmClient, unselectClient, selectAgreement, selectNextAgreement, selectPreviousAgreement, refreshGroupedDebts,
  } = useWizardClientSelection({
    clientNetId, initialClient, permissionFlow, hasRegistryItems: registryItems.length > 0,
    onClientChange, onClientResolved, onAgreementChange, resetRegister, fetchRegister,
    onShowClient: navigation.showClient,
  })
  const handleSelectAgreement = useCallback((agreement: ClientAgreement) => {
    cancelPendingMove()
    selectAgreement(agreement)
  }, [cancelPendingMove, selectAgreement])
  const { query, setQuery, handleQueryChange, runVirtualLoad } = useWizardClientSearch({
    permissionFlow,
    onResults: navigation.applySearchResults,
    onAppendResults: navigation.appendSearchResults,
  })
  const actions = useWizardSalesRegisterActions({
    clientKey: selectedClient ? String(selectedClient.NetUid || selectedClient.Id || '') : null,
    canConvertMergedToBill, canEdit, canOpenDeliveryDetails, canOpenDetails, canViewAudit,
    permissionScopedSalesUkraineApi, onOpenSale, onCreateMergedMainClientSale, onEditMergedSale, onInvoiceMergedSale,
    fetchRegister, refreshAfterSave, refreshGroupedDebts, refreshRegistryRow, replaceRegistryRow,
  })
  const { keyboardState, handleSearchChange } = useWizardClientKeyboard({
    navigation, hasOpenOverlay: actions.hasOpenOverlay, unselectClient,
    selectNextAgreement, selectPreviousAgreement, setQuery, handleQueryChange, onRequestClose,
  })

  const focusedGroup = !selectedClient && carousel.selected && !isWizardSaleClientSelectable(carousel.selected)
    ? carousel.selected
    : null
  const headerClient = selectedClient ?? focusedGroup
  const selectedAgreementClientId = selectedAgreement?.ClientId ?? selectedAgreement?.Client?.Id

  return (
    <>
      <Box className="new-sale-client-step">
        {headerClient && (
          <WizardClientHeroHeader
            activeAgreementNetId={selectedAgreementKey}
            agreements={agreements}
            client={headerClient}
            groupSize={focusedGroup ? getClientFolderChildren(focusedGroup).length : undefined}
            debts={groupedDebts}
            identityAttention={identityAttention}
            headerClose={headerClose}
            headerTools={focusedGroup ? undefined : headerTools}
            permissionFlow={permissionFlow}
            registryCount={registryItems.length}
          />
        )}

        <Box className="new-sale-client-drum-panel">
          <Box className="new-sale-client-drum-panel__glow" />
          <Box className="new-sale-client-drum-panel__body">
            <WizardClientCarousel
              carousel={carousel}
              hasDebt={Boolean(selectedClient) && groupedDebts.length > 0}
              hideName={false}
              searchInputRef={searchInputRef}
              searchMode={keyboardState === 'ClientSearch'}
              searchValue={query}
              selectedClientKey={selectedClient ? String(selectedClient.NetUid || selectedClient.Id || '') : ''}
              onPickClient={pickClient}
              onSearchChange={handleSearchChange}
            />
          </Box>
        </Box>

        <Box className="new-sale-client-workspace">
          {selectedClient ? (
            <>
              <Box className="new-sale-client-agreements-zone">
                <WizardClientAgreementsStrip
                  isLoading={agreementsLoading}
                  agreements={agreements}
                  selectedKey={selectedAgreementKey}
                  onSelect={handleSelectAgreement}
                />
              </Box>
              <WizardClientRegistry
                canEdit={canEdit}
                canOpenDeliveryDetails={canOpenDeliveryDetails}
                canOpenDetails={canOpenDetails}
                canViewAudit={canViewAudit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                isLoading={isRegistryLoading}
                items={registryItems}
                saleSearch={saleSearch}
                selectedAgreementClientId={selectedAgreementClientId}
                status={statusFilter}
                onAuditRow={actions.openAudit}
                onChangeDateFrom={handleDateFromChange}
                onChangeDateTo={handleDateToChange}
                onChangeSaleSearch={handleSaleSearchChange}
                onChangeStatus={handleStatusChange}
                onDeliveryRow={actions.openDeliveryRow}
                onEditRow={actions.openEditRow}
                onOpenOrderedProducts={actions.openOrderedProducts}
                onOpenRow={actions.openRow}
                onPrintRow={actions.printRow}
              />
            </>
          ) : (
            <Stack align="center" className="new-sale-client-empty" gap={10} justify="center">
              <span className="new-sale-client-empty__icon">
                <UserSearch size={20} strokeWidth={1.7} />
              </span>
              <Stack align="center" gap={3}>
                <Text className="new-sale-client-empty__title">{t(focusedGroup ? 'Оберіть картку групи' : 'Оберіть клієнта')}</Text>
                <Text className="new-sale-client-empty__description">
                  {t(focusedGroup ? 'Натисніть Enter, щоб відкрити групу, та оберіть потрібну картку стрілками.' : 'Оберіть клієнта у списку зліва, щоб відкрити договори, борги та реєстр документів.')}
                </Text>
              </Stack>
            </Stack>
          )}
        </Box>
      </Box>

      <WizardSalesRegisterOverlays
        actions={actions}
        canConvertMergedToBill={canConvertMergedToBill}
        canEdit={canEdit}
        clientNetId={selectedClient?.NetUid ?? null}
        permissionScopedSalesUkraineApi={permissionScopedSalesUkraineApi}
      />
    </>
  )
}
