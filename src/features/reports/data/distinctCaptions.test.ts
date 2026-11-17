import { expect, it } from 'vitest'
import { distinctOptions, plainCaption, savedValueCaptions } from './distinctCaptions'

it('strips a stored bracket id from an old saved name', () => {
  expect(plainCaption('Товар [35430089]')).toBe('Товар')
  expect(plainCaption('Петренко Іван [id=20]')).toBe('Петренко Іван')
  expect(savedValueCaptions([{ Data: { Id: '35430089' }, Name: 'Фільтр · W712 [35430089]' }])).toEqual(['Фільтр · W712'])
})

it('re-adds the id only when saved values print identically', () => {
  expect(savedValueCaptions([
    { Data: { Id: '11' }, Name: 'Фільтр · A1 [11]' },
    { Data: '{"Id":"12"}', Name: 'Фільтр · A1' },
    { Data: { Id: '13' }, Name: 'Фільтр · B2 [13]' },
  ])).toEqual(['Фільтр · A1 [11]', 'Фільтр · A1 [12]', 'Фільтр · B2'])
})

it('keeps option values and marks only clashing captions', () => {
  expect(distinctOptions([
    { value: '10', label: 'Одна назва' },
    { value: '20', label: 'Одна назва [20]' },
    { value: 'invalid:2', label: 'Без ключа' },
  ])).toEqual([
    { value: '10', label: 'Одна назва [10]' },
    { value: '20', label: 'Одна назва [20]' },
    { value: 'invalid:2', label: 'Без ключа' },
  ])
})
