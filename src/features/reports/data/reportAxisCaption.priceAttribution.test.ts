import { expect, it } from 'vitest'
import { reportAxisCaption, type ReportCaptionAxisSchema } from './reportAxisCaption'
const axes=['SaleDocumentManagerInput','Supplier']as const
const schema=(Identity:string):ReportCaptionAxisSchema=>({Caption:'Підтверджена вісь',Identity,Captioned:true,KeyKind:'Numeric',DisplayKind:'Text'})
it.each(axes.flatMap(axis=>['Нерозподілено','Справжня назва [2025]','Однакове ім’я (ID 9007199254740993)'].map(caption=>({axis,caption}))))('preserves complete owned$axis caption$caption on a one-row page',({axis,caption})=>{
 expect(reportAxisCaption('NativePriceComparison',schema(axis),caption)).toBe(caption)
 // These exact prior negative exemplars are now valid owned schemas; retain both original business-caption strings explicitly.
 for(const prior of ['Бізнес [2025]','Business [2025]'])expect(reportAxisCaption('NativePriceComparison',schema(axis),prior)).toBe(prior)
})
it.each(axes.flatMap(axis=>[{Captioned:false},{KeyKind:'Text'},{DisplayKind:'Numeric'}].map(flags=>({axis,flags}))))('requires every supplied identity flag for$axis /$flags',({axis,flags})=>{
 expect(reportAxisCaption('NativePriceComparison',{...schema(axis),...flags},'Назва [42]')).toBe('Назва')
})
it.each(axes.flatMap(axis=>['NativeSalesNet','NativeCustomerGroupComparison'].map(source=>({axis,source}))))('does not widen legacy$source /$axis supplied-caption ownership',({axis,source})=>{
 expect(reportAxisCaption(source,schema(axis),'Назва [42]')).toBe('Назва')
})
