import type { OnlineShopAgreement, OnlineShopClient, OnlineShopOrganization, OnlineShopStorage } from './types'

type AgreementConfiguration = {
  agreement: OnlineShopAgreement
  organization: OnlineShopOrganization | null | undefined
}

export function hasCompatibleEcommerceStorage(
  client: OnlineShopClient,
  storages: OnlineShopStorage[],
) {
  return getClientAgreementConfigurations(client).some(({ agreement, organization }) => {
    if (agreement.Deleted || agreement.IsActive === false) {
      return false
    }

    const agreementOrganizationId = agreement.OrganizationId ?? agreement.Organization?.Id ?? organization?.Id

    return agreementOrganizationId != null && storages.some((storage) =>
      !storage.Deleted
      && storage.ForEcommerce === true
      && (storage.OrganizationId ?? storage.Organization?.Id) === agreementOrganizationId
      && Boolean(storage.ForVatProducts) === Boolean(agreement.WithVATAccounting),
    )
  })
}

export function hasValidRetailConfiguration(
  clients: OnlineShopClient[],
  storages: OnlineShopStorage[],
) {
  return clients.some((client) =>
    client.IsForRetail === true
    && !client.Deleted
    && hasCompatibleEcommerceStorage(client, storages),
  )
}

function getClientAgreementConfigurations(client: OnlineShopClient): AgreementConfiguration[] {
  const configurations: AgreementConfiguration[] = []

  if (client.Agreement) {
    configurations.push({ agreement: client.Agreement, organization: client.Agreement.Organization })
  }

  if (client.ClientAgreement?.Agreement && !client.ClientAgreement.Deleted) {
    configurations.push({
      agreement: client.ClientAgreement.Agreement,
      organization: client.ClientAgreement.Organization,
    })
  }

  for (const clientAgreement of client.ClientAgreements || []) {
    if (clientAgreement.Agreement && !clientAgreement.Deleted) {
      configurations.push({
        agreement: clientAgreement.Agreement,
        organization: clientAgreement.Organization,
      })
    }
  }

  return configurations
}
