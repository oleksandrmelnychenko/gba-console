import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { RETURN_COMPARISON_CAPTIONS, RETURN_COMPARISON_TITLE, defaultReturnComparison } from './returnComparison'
import { RETURN_COMPARISON_NOTE_PREFIXES, RETURN_COMPARISON_EMPTY_STATE } from './returnComparisonSpreadsheet'

// Synthetic independent controls: stored current Amount120+30 gives contribution−150;
// stored previous Amount100 gives−100, raw difference−50 and signed relative change50%.
export const returnDataset: ReportDataset = {
  DataSource:18, Name:RETURN_COMPARISON_TITLE, Description:'Записані повернення покупців за двома незалежними періодами та точними договорами.',
  Groupings:[{Type:12,Name:'Клієнт'},{Type:15,Name:'Договір'}],
  Measurements:RETURN_COMPARISON_CAPTIONS.map((Name,index)=>({Type:47+index,Name})),
  Filters:[{Type:1,Name:'Товар'},{Type:2,Name:'Артикул'},{Type:6,Name:'Клієнт'},{Type:9,Name:'Договір'},{Type:14,Name:'Повернення від клієнта'}],
  Limitations:['Записані суми без переоцінки; невідомість імпортованої валюти збережено.'],
  PeriodRequired:true,PeriodSupported:true,
  ReturnComparison: {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [4], "RoundingPolicy": "NativeReturnAmountFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Known current and previous totals with raw previous=0 give 100, including complete-empty 0/0", "UnknownPolicy": "Current and previous known independently; any unconfirmed return currency makes its period unknown; changes require both known", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending", "SourceParityVerified": false},
  FilterExpression:{Version:1,MaximumDepth:8,MaximumLeaves:64,MaximumNodes:128,Operators:[1,2]},
}
const controls: Record<string,Array<number|null>> = {
  known:[-150,-100,-50,50], 'current-unknown':[null,-100,null,null],
  'previous-unknown':[-50,null,null,null], 'both-unknown':[null,null,null,null],
  // Raw C=-0.006 and P=-0.004: published delta0 is correct; shown -0.01−0 is not the operand.
  'raw-rounding':[-0.01,0,0,50], signed:[20,-10,30,-300], empty:[0,0,0,100],
}
const notes = [
  'Обидва періоди включають крайні дні Києва; імпортовані дати місцеві, нативні дати UTC. Використовується дата повернення.',
  'Додатна записана сума входить зі зворотним знаком. Ціни договору, ПДВ, знижки й курси не застосовуються повторно.',
  'Поточна мінус попередня сума; відсоток зі знаком попередньої суми. Відомий попередній нуль дає100, включно0/0.',
  'Округлення обраних кінцевих результатів до двох десяткових знаків половинами від нуля.',
  'Лише активні повернення; імпортована сума без повного підтвердження валюти невідома. Відбір не звужує перевірку всього документа.',
  'Точні клієнт і договір підтверджені; неоднозначний початковий продаж зупиняє звіт, відсутній підпис не замінює ключ.',
  'Підсумки визначені з початкових сум сервером. Округлені рядки й відсотки не додаються.',
  'Поточні документи GBA. Джерельний регістр, коригування, права й календарні межі не підтверджено.',
]
export function returnRequest():ReportRequestBody {
  return {...defaultDatasetRequest(returnDataset,'2026-07-01','2026-07-31'),returnComparison:{...defaultReturnComparison(),From:'2026-06-01',To:'2026-06-30'}}
}
export function returnRows(kind='known',selected=[0,1,2,3]):SpreadsheetCellValue[][] {
  const values=controls[kind]; if(!values) throw new Error('Unknown synthetic fixture')
  const header:SpreadsheetCellValue[][]=[
    [RETURN_COMPARISON_TITLE],['Поточний період: 01.07.2026 – 31.07.2026'],['Період порівняння: 01.06.2026 – 30.06.2026'],
    ['Час читання (UTC): 09.09.2026 00:00:00.000 – 09.09.2026 00:00:01.000'],
    ['Рядки: Клієнт, Договір'],['Колонки: —'],['Показники: '+selected.map(index=>RETURN_COMPARISON_CAPTIONS[index]).join(', ')],
    ['Фільтри: не застосовано'],...RETURN_COMPARISON_NOTE_PREFIXES.map((prefix,index)=>['! '+prefix+' '+notes[index]]),
    ...(kind==='empty'?[[RETURN_COMPARISON_EMPTY_STATE]]:[]),[],
    [null,null,...selected.map(()=>'Записані повернення')],['Клієнт','Договір',...selected.map(index=>RETURN_COMPARISON_CAPTIONS[index])],
  ]
  const body:SpreadsheetCellValue[][]=kind==='empty'?[]:kind==='known'?
    [['Клієнт [1]','Договір [201]',-120,-100,-20,20],['Клієнт [1]','Договір [202]',-30,0,-30,100],['Підсумок: Клієнт [1]',null,...values]]:
    [['Клієнт [1]','Договір [201]',...values],['Підсумок: Клієнт [1]',null,...values]]
  body.push(['Загальний підсумок',null,...values])
  return [...header,...body.map(row=>[...row.slice(0,2),...selected.map(index=>row[index+2]??null)])]
}
