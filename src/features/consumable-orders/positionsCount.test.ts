import { describe, expect, it } from 'vitest'
import { getPositionsWord } from './positionsCount'

describe('positions count word', () => {
  it.each([
    [1, 'позиція'],
    [21, 'позиція'],
    [2, 'позиції'],
    [4, 'позиції'],
    [0, 'позицій'],
    [5, 'позицій'],
    [11, 'позицій'],
    [12, 'позицій'],
  ])('%i → %s', (count, word) => {
    expect(getPositionsWord(count)).toBe(word)
  })
})
