import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { PAYMENT_COMPARISON_CAPTIONS, PAYMENT_COMPARISON_RESOURCE, PAYMENT_COMPARISON_TITLE, defaultPaymentComparison } from './paymentComparison'
import { PAYMENT_COMPARISON_EMPTY_STATE, paymentComparisonNotes } from './paymentComparisonSpreadsheet'
import { defaultDatasetRequest } from './reportDatasets'
// Actual production GbaJsonSerializer dataset from immutable wire05 (final clarified limitation and capability order).
export const paymentDataset: ReportDataset = {
  "DataSource": 21,
  "Name": "Порівняння імпортованих платежів за договорами",
  "Description": "Записані імпортовані надходження або виплати у валюті документа за двома незалежними періодами.",
  "Groupings": [
    {
      "Type": 41,
      "Name": "Валюта рахунку",
      "Selectable": true
    },
    {
      "Type": 12,
      "Name": "Клієнт",
      "Selectable": true
    },
    {
      "Type": 15,
      "Name": "Договір",
      "Selectable": true
    }
  ],
  "Measurements": [
    {
      "Type": 59,
      "Name": "Сума за поточний період",
      "Selectable": true
    },
    {
      "Type": 60,
      "Name": "Сума за період порівняння",
      "Selectable": true
    },
    {
      "Type": 61,
      "Name": "Зміна суми",
      "Selectable": true
    },
    {
      "Type": 62,
      "Name": "Відносна зміна платежів, %",
      "Selectable": true
    }
  ],
  "Filters": [
    {
      "Type": 6,
      "Name": "Клієнт",
      "Selectable": true
    },
    {
      "Type": 9,
      "Name": "Договір",
      "Selectable": true
    },
    {
      "Type": 28,
      "Name": "Організація документа",
      "Selectable": true
    },
    {
      "Type": 29,
      "Name": "Рахунок",
      "Selectable": true
    },
    {
      "Type": 30,
      "Name": "Валюта рахунку",
      "Selectable": true
    },
    {
      "Type": 33,
      "Name": "Тип рахунку",
      "Selectable": true
    },
    {
      "Type": 35,
      "Name": "Запис імпортованого платежу",
      "Selectable": true
    },
    {
      "Type": 37,
      "Name": "Стаття записаного платежу",
      "Selectable": true
    },
    {
      "Type": 38,
      "Name": "Система імпорту платежу",
      "Selectable": true
    }
  ],
  "Limitations": [
    "Поточний збережений стан імпортованих документів; дата документа не є часом банківського виконання.",
    "Суми у власній підтвердженій валюті, без конвертації та переоцінки договорів; різні валюти не підсумовуються.",
    "Непідтверджені суми залишаються невідомими. Ручні документи, перекази та обміни поза цим набором; від’ємні суми зберігаються без окремої класифікації повернень.",
    "Оригінальні показники 1С використовують управлінську валюту й інші правила невідомих сум; повну відповідність не підтверджено."
  ],
  "PeriodRequired": true,
  "PeriodSupported": true,
  "paymentComparison": {
    "Version": 1,
    "Required": true,
    "DateFormat": "yyyy-MM-dd",
    "CalendarTimezone": "Europe/Kyiv",
    "Directions": [
      1,
      2
    ],
    "RoundingPolicy": "NativeRecordedPaymentFinal4RelativeAwayFromZero2",
    "RequiredRows": [
      41,
      12,
      15
    ],
    "ColumnsSupported": false,
    "MaximumFacts": 200000,
    "MaximumPeriodMemberships": 400000,
    "MaximumDenseCells": 1000000,
    "MaximumSelections": 64,
    "MaximumFilterValues": 2000,
    "MoneyDecimalPlaces": 4,
    "RelativeDecimalPlaces": 2,
    "ZeroPreviousPolicy": "Both amounts known and previous=0 gives relative change100, including0/0",
    "UnknownPolicy": "Unconfirmed money poisons only its period; changes require both periods known",
    "CurrencyPolicy": "One confirmed exact currency across both periods per group; mixed or unknown currency makes every output unknown",
    "OrderingPolicy": "Nullable currency ID, client ID and exact ClientAgreement ID ascending; unknown first",
    "AmountPolicy": "Recorded native document amount at four decimal places; no FX conversion or repricing",
    "EmptyPolicy": "Complete empty scope has no leaves and no grand row",
    "SourceParityVerified": false
  },
  "HideZero": null
}
export function paymentRequest(): ReportRequestBody {
 return {...defaultDatasetRequest(paymentDataset,'2026-07-01','2026-07-31'),paymentComparison:{...defaultPaymentComparison(),From:'2026-06-01',To:'2026-06-30',Direction:1}}
}
export function paymentRows(kind:'known'|'mixed'|'current-unknown'|'previous-unknown'|'both-unknown'|'unknown-currency'|'empty'='known', selected=[0,1,2,3]): SpreadsheetCellValue[][] {
 const notes=paymentComparisonNotes(1).map(line=>`! ${line}`)
 const headers=[PAYMENT_COMPARISON_TITLE,'Поточний період: 01.07.2026 – 31.07.2026','Період порівняння: 01.06.2026 – 30.06.2026','Час читання (UTC): 09.09.2026 12:00:00.000 – 09.09.2026 12:00:00.100','Рядки: Валюта рахунку, Клієнт, Договір','Колонки: —',`Показники: ${selected.map(i=>PAYMENT_COMPARISON_CAPTIONS[i]).join(', ')}`,'Фільтри: не застосовано',...notes]
 if(kind==='empty')headers.push(PAYMENT_COMPARISON_EMPTY_STATE)
 const row=(currency:string,client:string,contract:string,values:Array<number|null>)=>[currency,client,contract,...selected.map(i=>values[i])]
 const a=kind==='current-unknown'?[null,80,null,null]:kind==='previous-unknown'?[120,null,null,null]:kind==='both-unknown'||kind==='unknown-currency'?[null,null,null,null]:[120,80,40,50]
 const currency=kind==='unknown-currency'?'Невідомо':'EUR [2]'
 const rows=kind==='empty'?[]:[row(currency,'Клієнт [101]','Договір [201]',a),row(currency,'Підсумок: Клієнт [101]','',a),row(`Підсумок: ${currency}`,'','',a)]
 if(kind==='mixed')rows.push(row('UAH [3]','Клієнт [101]','Договір [202]',[0,0,0,100]),row('Підсумок: UAH [3]','','',[0,0,0,100]))
 if(kind!=='empty')rows.push(row('Загальний підсумок','','',kind==='mixed'?[null,null,null,null]:a))
 return [...headers.map(line=>[line,line,line]),[],['','','',...selected.map(()=>PAYMENT_COMPARISON_RESOURCE)],['Валюта рахунку','Клієнт','Договір',...selected.map(i=>PAYMENT_COMPARISON_CAPTIONS[i])],...rows]
}

// Actual production GbaJsonSerializer request, retained independently of the dataset capability correction.
export const actualPaymentRequestWire = {"DataSource":21,"OneC":null,"ValuationClientAgreementId":null,"PaymentComparison":{"Version":1,"From":"2026-06-01","To":"2026-06-30","Direction":1,"RoundingPolicy":"NativeRecordedPaymentFinal4RelativeAwayFromZero2"},"From":"2026-07-01","To":"2026-07-31","Sorted":{"Col":[],"Row":[{"type":41,"label":null,"key":null},{"type":12,"label":null,"key":null},{"type":15,"label":null,"key":null}],"Measurements":[{"Type":59,"ParentName":null,"Name":null,"IsChecked":null},{"Type":60,"ParentName":null,"Name":null,"IsChecked":null},{"Type":61,"ParentName":null,"Name":null,"IsChecked":null},{"Type":62,"ParentName":null,"Name":null,"IsChecked":null}]},"Selections":[],"FilterExpression":null,"Ordering":null,"TopGroups":null,"Threshold":null,"HideZero":null,"AbcClassification":null}
