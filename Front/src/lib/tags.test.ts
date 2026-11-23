import { describe, expect, it } from 'vitest'
import { parseTags, tagsError } from './tags'

describe('parseTags', () => {
  it('splits on commas and spaces, strips #, lowercases, dedupes', () => {
    expect(parseTags('#Travel, work  travel,,')).toEqual(['travel', 'work'])
    expect(parseTags('')).toEqual([])
    expect(parseTags('Bakı')).toEqual(['bakı'])
  })
})

describe('tagsError', () => {
  it('flags bad characters and too many tags', () => {
    expect(tagsError(['ok', 'also_ok-1'])).toBeNull()
    expect(tagsError(['bad!'])).toMatch(/letters/)
    expect(tagsError(Array.from({ length: 11 }, (_, i) => `t${i}`))).toMatch(/at most/)
  })
})
