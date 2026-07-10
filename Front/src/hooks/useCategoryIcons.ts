import { useMemo } from 'react'
import { useCategories } from './useCategories'

/** Transactions/recurring rules carry a `category_id` but not the icon key.
 * This resolves id → icon key via the categories list so rows can render the
 * right glyph (matches the prototype's `paths(t.category)` lookup by name). */
export function useCategoryIconById() {
  const { data: categories } = useCategories()
  return useMemo(() => {
    const map = new Map<number, string>()
    categories?.forEach((c) => map.set(c.id, c.icon))
    return (id: number | null | undefined) => (id != null ? map.get(id) ?? 'other' : 'other')
  }, [categories])
}
