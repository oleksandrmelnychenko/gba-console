/** Wizard wording follows the role: a supplier is not called «клієнт». */
export function newClientRoleTexts(isProvider: boolean, t: (value: string) => string) {
  return {
    nameRequired: isProvider ? t('Вкажіть назву постачальника') : t('Вкажіть назву клієнта'),
    created: isProvider ? t('Постачальника створено') : t('Клієнта створено'),
    createdWithoutDocuments: isProvider ? t('Постачальника створено без документів') : t('Клієнта створено без документів'),
    createDisabledReason: isProvider
      ? t('«Створити» стане доступною після додавання договору (з типом цін постачальника) на цьому кроці.')
      : t('«Створити» стане доступною після додавання договору на цьому кроці.'),
  }
}
