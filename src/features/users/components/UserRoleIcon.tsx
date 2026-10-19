import { BadgeCheck, Calculator, ChartNoAxesCombined, Shield, Truck, Users, Warehouse } from 'lucide-react'

/** Role names are configurable; unknown roles use the same neutral role icon. */
export function UserRoleIcon({ name }: { name: string }) {
  const label = name.toLocaleLowerCase('uk')
  const Icon = /адмін|admin|^gba$/.test(label) ? Shield
    : /бухгал|фінанс|account|financ/.test(label) ? Calculator
      : /логіст|водій|logist|driver/.test(label) ? Truck
        : /склад|warehouse/.test(label) ? Warehouse
          : /аналіт|analyst/.test(label) ? ChartNoAxesCombined
            : /керівник|менеджер|manager/.test(label) ? Users
              : BadgeCheck

  return <Icon aria-hidden="true" className="user-role-icon" size={16} strokeWidth={1.8} />
}
