/** Category / form types — categories and recurring rules are only income or expense. */
export type TxnType = 'income' | 'expense'
/** A transaction can also be a transfer between accounts. */
export type TransactionType = 'income' | 'expense' | 'transfer'
export type Frequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
export type Period = 'monthly' | 'all' | 'range'

export interface Settings {
  accent_color: string
  currency_symbol: string
  show_cents: boolean
}

export interface Account {
  id: number
  name: string
  type: string
  icon: string
  removable: boolean
  /** money already in the account when it was added */
  opening_balance: number
  /** current balance: opening balance + all activity */
  net: number
  transaction_count: number
}

export interface Category {
  id: number
  name: string
  type: TxnType
  icon: string
  budget: number | null
}

export interface CategoryBudgetItem {
  category_id: number
  name: string
  icon: string
  spent: number
  budget: number | null
  pct_used: number | null
}

export interface CategoryBudgetSummary {
  categories: CategoryBudgetItem[]
  spent_total: number
  budget_total: number
  pct: number
  budgeted_count: number
}

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  description: string
  note: string | null
  tags: string[]
  category_id: number | null
  category_name: string | null
  account_id: number
  account_name: string
  transfer_account_id: number | null
  transfer_account_name: string | null
  date: string
}

export interface TransactionPage {
  items: Transaction[]
  /** number of rows matching the filters, across all pages */
  total: number
}

export interface Tag {
  id: number
  name: string
  count: number
  income: number
  expense: number
}

export interface ImportResult {
  created: number
  skipped: number
  errors: { row: number; reason: string }[]
}

export interface RecurringRule {
  id: number
  description: string
  amount: number
  category_id: number | null
  category_name: string | null
  account_id: number
  account_name: string
  transfer_account_id: number | null
  transfer_account_name: string | null
  type: TransactionType
  frequency: Frequency
  next_due_date: string
  /** post due occurrences straight away instead of asking */
  auto_approve: boolean
}

export interface PendingApproval {
  id: number
  recurring_rule_id: number
  description: string
  amount: number
  category_id: number | null
  category_name: string | null
  account_id: number
  account_name: string
  transfer_account_id: number | null
  transfer_account_name: string | null
  type: TransactionType
  due_date: string
}

export interface CatchUpResult {
  generated: number
  /** occurrences of auto-approve rules posted straight to transactions */
  posted: number
  pending: PendingApproval[]
}

export interface Goal {
  id: number
  name: string
  icon: string
  target_amount: number
  saved_amount: number
  remaining: number
  pct: number
  target_date: string | null
  months_left: number | null
  /** how much to put aside each month to make the target date */
  monthly_needed: number | null
  completed: boolean
}

export interface ReportCategory {
  category_id: number
  name: string
  icon: string
  amount: number
  previous: number
  change_pct: number | null
  budget: number | null
  over_budget: boolean
}

export interface MonthlyReport {
  year: number
  month: number
  current: Summary
  previous: Summary
  income_change_pct: number | null
  expense_change_pct: number | null
  transaction_count: number
  avg_daily_expense: number
  categories: ReportCategory[]
  top_expenses: { id: number; description: string; category_name: string | null; amount: number; date: string }[]
  tags: { name: string; amount: number }[]
}

export interface Summary {
  income: number
  expense: number
  balance: number
  savings_rate: number
}

export interface TrendPoint {
  label: string
  year: number
  month: number
  income: number
  expense: number
}

export interface CategoryBreakdownItem {
  category_id: number
  name: string
  amount: number
  pct: number
}

export interface CumulativePoint {
  date: string
  balance: number
}

/** Shared query params every list/stat endpoint accepts for the current period selection. */
export interface PeriodParams {
  period: Period
  year?: number
  month?: number
}

export interface MmbakPreview {
  currency_iso: string | null
  currency_symbol: string | null
  date_from: string | null
  date_to: string | null
  income: number
  expense: number
  transfer: number
  adjustments: number
  duplicates: number
  skipped: number
  new_accounts: string[]
  existing_accounts: string[]
  new_categories: string[]
  existing_categories: string[]
  warnings: string[]
  sample: {
    date: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    description: string
    account: string
    to_account: string | null
    category: string | null
  }[]
}

export interface MmbakResult {
  transactions: number
  adjustments: number
  accounts: number
  categories: number
  duplicates: number
  skipped: number
  currency_symbol: string | null
}
