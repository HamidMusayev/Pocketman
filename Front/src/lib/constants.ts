/** Closed vocabularies mirrored from `Backend/app/constants.py`. Keep in sync. */
import type { Frequency } from '../api/types'

export const CATEGORY_ICON_KEYS = [
  'salary', 'freelance', 'car', 'dining', 'entertainment', 'food', 'fuel',
  'healthcare', 'housing', 'personal', 'subscriptions', 'transport',
  'travel', 'utilities', 'fitness', 'other',
] as const

export const ACCOUNT_ICON_KEYS = ['wallet', 'bank', 'card'] as const

export const ACCOUNT_TYPES = ['cash', 'savings', 'card', 'investment'] as const

export const FREQUENCIES: Frequency[] = ['Daily', 'Weekly', 'Monthly', 'Yearly']

export const ACCENT_COLORS = [
  { value: '#FCD535', label: 'Yellow' },
  { value: '#2dbdb6', label: 'Turquoise' },
  { value: '#0ecb81', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
]

export const ACCOUNT_ICON_LABELS: Record<string, string> = {
  wallet: 'Wallet',
  bank: 'Bank',
  card: 'Card',
}
