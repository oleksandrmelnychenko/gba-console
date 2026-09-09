import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { MARGIN_COMPARISON_CAPTIONS, MARGIN_COMPARISON_TITLE, defaultMarginComparison } from './marginComparison'
import { MARGIN_COMPARISON_NOTE_PREFIXES, MARGIN_COMPARISON_EMPTY_STATE } from './marginComparisonSpreadsheet'

// Synthetic margin controls: C contracts 30/100 and 30/300; P contracts20/100 and0/100.
// Weighted total C=15%,P=10%,difference5points,relative50%; never mean or sum of leaf ratios.
// Exact source20 entry from production GbaJsonSerializer, pinned in private actual-wire-import-01.json.
export const marginDataset: ReportDataset = {
  "DataSource": 20,
  "Name": "Порівняння маржі без ПДВ за договорами",
  "Description": "Маржа записаних продажів без ПДВ за двома незалежними періодами та точними договорами.",
  "Groupings": [
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
      "Type": 55,
      "Name": "Маржа за поточний період, %",
      "Selectable": true
    },
    {
      "Type": 56,
      "Name": "Маржа за період порівняння, %",
      "Selectable": true
    },
    {
      "Type": 57,
      "Name": "Зміна маржі, в.п.",
      "Selectable": true
    },
    {
      "Type": 58,
      "Name": "Відносна зміна маржі, %",
      "Selectable": true
    }
  ],
  "Filters": [
    {
      "Type": 1,
      "Name": "Товар",
      "Selectable": true
    },
    {
      "Type": 2,
      "Name": "Артикул",
      "Selectable": true
    },
    {
      "Type": 6,
      "Name": "Клієнт",
      "Selectable": true
    },
    {
      "Type": 9,
      "Name": "Договір",
      "Selectable": true
    }
  ],
  "Limitations": [
    "Записана виручка зменшується на ПДВ рядка за записаним курсом. Поточні податки, курси, знижки й ціни договорів не застосовуються.",
    "Історична собівартість без ПДВ доступна лише за повного підтвердження збережених імпортованих розподілів. Поточні партії та резерви її не підміняють.",
    "Підсумки заново обчислюють маржу із точних сум продажу та собівартості, без додавання чи усереднення відсотків.",
    "Невідомі продажі без ПДВ або собівартість залишають маржу відповідного періоду порожньою. Відомий нуль продажів дає маржу нуль лише за підтвердженої собівартості.",
    "Враховано проведені продажі GBA за київськими датами. Документи повернення не віднімаються.",
    "Поточні записи та збережені прив’язки GBA не доводять повну історію, права, повноту записів регістрів або числову відповідність 1С."
  ],
  "PeriodRequired": true,
  "PeriodSupported": true,
  "MarginComparison": {
    "Version": 1,
    "Required": true,
    "DateFormat": "yyyy-MM-dd",
    "CalendarTimezone": "Europe/Kyiv",
    "BaseResources": [
      14
    ],
    "RoundingPolicy": "NativeNetMarginFinalAwayFromZero2",
    "RequiredRows": [
      12,
      15
    ],
    "ColumnsSupported": false,
    "MaximumFacts": 200000,
    "MaximumPeriodMemberships": 400000,
    "MaximumContracts": 200000,
    "MaximumDenseCells": 1000000,
    "MaximumSelections": 64,
    "MaximumFilterValues": 2000,
    "PublishedDecimalPlaces": 2,
    "ZeroPreviousPolicy": "Both margins known and previous raw margin=0 gives relative change100, including0/0",
    "UnknownPolicy": "Unknown recorded net sales or historical net cost makes that period margin unknown; changes require both periods known",
    "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending",
    "CostPolicy": "Complete retained imported net allocations for the whole native sale before display filters; no current lot or reservation fallback",
    "NetSalesPolicy": "Exact recorded gross EUR minus recorded line VAT divided by positive recorded line rate; zero VAT needs no rate; null VAT remains unknown",
    "MarginZeroDenominatorPolicy": "Known raw net sales=0 gives margin0 only with complete known cost; no0..100 clamp",
    "MaximumRationalBits": 65536,
    "SourceParityVerified": false
  },
  "FilterExpression": {
    "Version": 1,
    "MaximumDepth": 8,
    "MaximumLeaves": 64,
    "MaximumNodes": 128,
    "Operators": [
      1,
      2
    ]
  },
  "HideZero": null
}

const controls: Record<string,Array<number|null>> = {
  known:[15,10,5,50], 'current-unknown':[null,20,null,null],
  'previous-unknown':[30,null,null,null], 'both-unknown':[null,null,null,null],
  // Raw current margin0.006%, previous0.004%: displayed0.01/0.00 yet delta0.00 and relative50%.
  'raw-rounding':[0.01,0,0,50], signed:[20,-10,30,-300], empty:[0,0,0,100],
}
const notes = [
  'GBA, набір 20; записані проведені продажі й підтверджена історична собівартість.',
  'Обидва періоди включають крайні дні за Києвом; використовуються дати проведених продажів.',
  'Клієнт → точний ClientAgreement.ID; спільний Agreement не замінює договір.',
  'Записана сума EUR мінус записаний ПДВ за записаним курсом; повторна переоцінка договору не застосовується.',
  'Повні підтверджені імпортовані нетто-розподіли; поточна собівартість не підставляється.',
  'Маржа відносно продажів; різниця у відсоткових пунктах; відносна зміна зі знаком попередньої маржі. Відомий попередній нуль дає100, включно0/0. Підсумки з вихідних сум.',
  'Невідомі продажі або собівартість залишають період невідомим; похідні потребують обох періодів.',
  'Повернення поза обсягом; повну відповідність 1С не підтверджено.',
]
export function marginRequest():ReportRequestBody {
  return {...defaultDatasetRequest(marginDataset,'2026-07-01','2026-07-31'),marginComparison:{...defaultMarginComparison(),From:'2026-06-01',To:'2026-06-30'}}
}
export function marginRows(kind='known',selected=[0,1,2,3]):SpreadsheetCellValue[][] {
  const values=controls[kind]; if(!values) throw new Error('Unknown synthetic fixture')
  const header:SpreadsheetCellValue[][]=[
    [MARGIN_COMPARISON_TITLE],['Поточний період: 01.07.2026 – 31.07.2026'],['Період порівняння: 01.06.2026 – 30.06.2026'],
    ['Час читання (UTC): 09.09.2026 00:00:00.000 – 09.09.2026 00:00:01.000'],
    ['Рядки: Клієнт, Договір'],['Колонки: —'],['Показники: '+selected.map(index=>MARGIN_COMPARISON_CAPTIONS[index]).join(', ')],
    ['Фільтри: не застосовано'],...MARGIN_COMPARISON_NOTE_PREFIXES.map((prefix,index)=>['! '+prefix+' '+notes[index]]),
    ...(kind==='empty'?[[MARGIN_COMPARISON_EMPTY_STATE]]:[]),[],
    [null,null,...selected.map(()=>'Маржа без ПДВ')],['Клієнт','Договір',...selected.map(index=>MARGIN_COMPARISON_CAPTIONS[index])],
  ]
  const body:SpreadsheetCellValue[][]=kind==='empty'?[]:kind==='known'?
    [['Клієнт [1]','Договір [201]',30,20,10,50],['Клієнт [1]','Договір [202]',10,0,10,100],['Підсумок: Клієнт [1]',null,...values]]:
    [['Клієнт [1]','Договір [201]',...values],['Підсумок: Клієнт [1]',null,...values]]
  body.push(['Загальний підсумок',null,...values])
  return [...header,...body.map(row=>[...row.slice(0,2),...selected.map(index=>row[index+2]??null)])]
}

// Exact production request serialization, including nullable selection flags.
export const actualMarginRequestWire = {
  "DataSource": 20,
  "OneC": null,
  "ValuationClientAgreementId": null,
  "MarginComparison": {
    "Version": 1,
    "From": "2026-06-01",
    "To": "2026-06-30",
    "BaseResource": 14,
    "RoundingPolicy": "NativeNetMarginFinalAwayFromZero2"
  },
  "From": "2026-07-01",
  "To": "2026-07-31",
  "Sorted": {
    "Col": [],
    "Row": [
      {
        "type": 12,
        "label": null,
        "key": null
      },
      {
        "type": 15,
        "label": null,
        "key": null
      }
    ],
    "Measurements": [
      {
        "Type": 55,
        "ParentName": null,
        "Name": null,
        "IsChecked": null
      },
      {
        "Type": 56,
        "ParentName": null,
        "Name": null,
        "IsChecked": null
      },
      {
        "Type": 57,
        "ParentName": null,
        "Name": null,
        "IsChecked": null
      },
      {
        "Type": 58,
        "ParentName": null,
        "Name": null,
        "IsChecked": null
      }
    ]
  },
  "Selections": [],
  "FilterExpression": null,
  "Ordering": null,
  "TopGroups": null,
  "Threshold": null,
  "HideZero": null,
  "AbcClassification": null
}
