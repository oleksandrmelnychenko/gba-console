import { expect, it } from 'vitest'
import { orderReportNotes } from './reportNotesOrder'

const period = 'Період і групування дат — за київським часом (Europe/Kyiv), з урахуванням літнього часу.'
const imported = 'Для імпортованих продажів собівартість без ПДВ та її ПДВ взято окремо з партійних розподілів 1С у EUR.'
const quantity = 'Кількість — за рядками документів GBA в одиниці виміру товару. Змішані або невідомі одиниці залишають кількісний підсумок порожнім; грошові показники розраховано окремо.'
const unshipped = 'Продажі GBA без відвантаження не враховано в собівартості та прибутку: 10 на 1256.49 EUR з ПДВ (рядків: 13). Ці суми входять у продажі, тому прибуток менший за різницю продажів і собівартості.'
const formula = 'Рентабельність до собівартості = націнка ÷ собівартість × 100.'

it('puts notes with figures of this result first, then the explanation of a blank column, keeping the server order otherwise', () => {
  expect(orderReportNotes([period, imported, quantity, unshipped, formula], ['Кількість продажу', 'Кількість з урахуванням повернень']))
    .toEqual([unshipped, quantity, period, imported, formula])
})

it('keeps the server order when no column is blank and no note carries result figures', () => {
  expect(orderReportNotes([period, imported, quantity, formula], [])).toEqual([period, imported, quantity, formula])
})
