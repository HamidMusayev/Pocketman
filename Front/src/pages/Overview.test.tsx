import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodProvider } from '../context/PeriodContext'
import { addDaysIso, todayIso } from '../lib/dates'
import { renderWithProviders } from '../test-utils'
import { Overview } from './Overview'

const mocks = vi.hoisted(() => ({
  listTransactions: vi.fn(),
  listTransactionsPage: vi.fn(),
  createTransaction: vi.fn(),
  getBudgetSummary: vi.fn(),
  createPlanned: vi.fn(),
  listPlanned: vi.fn(),
  getForecast: vi.fn(),
  confirmPlanned: vi.fn(),
  postponePlanned: vi.fn(),
  deletePlanned: vi.fn(),
}))

vi.mock('../api/transactions', () => ({
  listTransactions: mocks.listTransactions,
  listTransactionsPage: mocks.listTransactionsPage,
  createTransaction: mocks.createTransaction,
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  importTransactionsCsv: vi.fn(),
  exportTransactionsCsv: vi.fn(),
  downloadCsvBlob: vi.fn(),
}))

vi.mock('../api/categories', () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: 1, name: 'Food', type: 'expense', icon: 'food', budget: null },
    { id: 2, name: 'Salary', type: 'income', icon: 'salary', budget: null },
  ]),
  getBudgetSummary: mocks.getBudgetSummary,
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock('../api/accounts', () => ({
  listAccounts: vi.fn().mockResolvedValue([
    { id: 5, name: 'Main', type: 'cash', icon: 'wallet', removable: false, net: 0, transaction_count: 0 },
  ]),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('../api/stats', () => ({
  getSummary: vi.fn().mockResolvedValue({ income: 0, expense: 0, balance: 0, savings_rate: 0 }),
}))

vi.mock('../api/recurring', () => ({
  listPending: vi.fn().mockResolvedValue([]),
  approvePending: vi.fn(),
  dismissPending: vi.fn(),
}))

vi.mock('../api/planned', () => ({
  listPlanned: mocks.listPlanned,
  getForecast: mocks.getForecast,
  createPlanned: mocks.createPlanned,
  updatePlanned: vi.fn(),
  confirmPlanned: mocks.confirmPlanned,
  postponePlanned: mocks.postponePlanned,
  deletePlanned: mocks.deletePlanned,
}))

vi.mock('../api/tags', () => ({
  listTags: vi.fn().mockResolvedValue([{ id: 1, name: 'travel', count: 3, income: 0, expense: 30 }]),
  deleteTag: vi.fn(),
}))

const emptyBudget = { categories: [], spent_total: 0, budget_total: 0, pct: 0, budgeted_count: 0 }

const txn = (id: number, extra = {}) => ({
  id,
  type: 'expense',
  amount: 10,
  description: `t${id}`,
  note: null,
  tags: [],
  category_id: 1,
  category_name: 'Food',
  account_id: 5,
  account_name: 'Main',
  transfer_account_id: null,
  transfer_account_name: null,
  date: '2026-07-15',
  ...extra,
})

vi.mock('../api/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    accent_color: '#FCD535',
    currency_symbol: '$',
    show_cents: true,
  }),
  updateSettings: vi.fn(),
}))

beforeEach(() => {
  mocks.listPlanned.mockResolvedValue([])
  mocks.getForecast.mockResolvedValue({ item_count: 0 })
})

afterEach(() => vi.clearAllMocks())

describe('Overview add-transaction form', () => {
  it('posts a transaction with the chosen category, amount and default account', async () => {
    mocks.listTransactionsPage.mockResolvedValue({ items: [], total: 0 })
    mocks.getBudgetSummary.mockResolvedValue(emptyBudget)
    mocks.createTransaction.mockResolvedValue({
      id: 99,
      type: 'expense',
      amount: 12,
      description: 'Food',
      category_id: 1,
      category_name: 'Food',
      account_id: 5,
      account_name: 'Main',
      date: '2026-07-15',
    })

    renderWithProviders(
      <PeriodProvider>
        <Overview />
      </PeriodProvider>,
    )

    const user = userEvent.setup()

    // open the add form from the page header
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // wait for the expense category chip to render (categories loaded)
    const foodChip = await screen.findByRole('button', { name: 'Food' })

    await user.type(screen.getByPlaceholderText('0.00'), '12,5')
    await user.click(foodChip)
    await user.click(screen.getByRole('button', { name: '+ Note & tags' }))
    await user.type(screen.getByLabelText('Note'), 'lunch with team')
    await user.click(await screen.findByRole('button', { name: '#travel' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mocks.createTransaction).toHaveBeenCalledTimes(1))
    expect(mocks.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amount: 12.5,
        description: 'Food',
        category_id: 1,
        account_id: 5,
        note: 'lunch with team',
        tags: ['travel'],
      }),
    )
  })
})

describe('Overview list', () => {
  it('loads more pages on demand and shows tags', async () => {
    mocks.getBudgetSummary.mockResolvedValue(emptyBudget)
    mocks.listTransactionsPage
      .mockResolvedValueOnce({ items: [txn(1, { tags: ['work'] }), txn(2)], total: 3 })
      .mockResolvedValueOnce({ items: [txn(3)], total: 3 })

    renderWithProviders(
      <PeriodProvider>
        <Overview />
      </PeriodProvider>,
    )
    expect(await screen.findByText('t1')).toBeInTheDocument()
    expect(screen.getByText('#work')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Show more (1 left)' }))
    expect(await screen.findByText('t3')).toBeInTheDocument()
    expect(mocks.listTransactionsPage).toHaveBeenLastCalledWith(expect.any(Object), 50, 2)
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument()
  })

  it('warns about categories close to or over budget', async () => {
    mocks.listTransactionsPage.mockResolvedValue({ items: [], total: 0 })
    mocks.getBudgetSummary.mockResolvedValue({
      ...emptyBudget,
      categories: [
        { category_id: 1, name: 'Food', icon: 'food', spent: 120, budget: 100, pct_used: 120 },
        { category_id: 3, name: 'Fuel', icon: 'fuel', spent: 85, budget: 100, pct_used: 85 },
        { category_id: 4, name: 'Fun', icon: 'other', spent: 10, budget: 100, pct_used: 10 },
      ],
    })
    renderWithProviders(
      <PeriodProvider>
        <Overview />
      </PeriodProvider>,
    )
    const alerts = await screen.findByRole('region', { name: 'Budget alerts' })
    expect(within(alerts).getByText(/over budget/)).toHaveTextContent('is $20.00 over budget')
    expect(within(alerts).getByText(/85% of its budget/)).toBeInTheDocument()
    expect(within(alerts).queryByText('Fun')).not.toBeInTheDocument()
  })
})

const planned = (id: number, due: string, extra = {}) => ({
  id,
  recurring_rule_id: null,
  frequency: null,
  description: `plan${id}`,
  amount: 500,
  note: null,
  tags: [],
  category_id: 1,
  category_name: 'Food',
  account_id: 5,
  account_name: 'Main',
  transfer_account_id: null,
  transfer_account_name: null,
  type: 'expense',
  due_date: due,
  ...extra,
})

function renderOverview() {
  mocks.listTransactionsPage.mockResolvedValue({ items: [], total: 0 })
  mocks.getBudgetSummary.mockResolvedValue(emptyBudget)
  renderWithProviders(
    <PeriodProvider>
      <Overview />
    </PeriodProvider>,
  )
  return userEvent.setup()
}

describe('Planned income and expenses', () => {
  it('saves a future-dated entry as planned instead of a transaction', async () => {
    mocks.createPlanned.mockResolvedValue(planned(1, addDaysIso(todayIso(), 5)))
    const user = renderOverview()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const foodChip = await screen.findByRole('button', { name: 'Food' })
    await user.type(screen.getByPlaceholderText('0.00'), '500')
    await user.click(foodChip)
    const dialog = screen.getByRole('dialog')
    const future = addDaysIso(todayIso(), 5)
    const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, future)
    expect(within(dialog).getByRole('note')).toHaveTextContent(/saved as planned/)
    await user.click(within(dialog).getByRole('button', { name: 'Plan it' }))
    await waitFor(() => expect(mocks.createPlanned).toHaveBeenCalledTimes(1))
    expect(mocks.createPlanned).toHaveBeenCalledWith(expect.objectContaining({ amount: 500, date: future, category_id: 1 }))
    expect(mocks.createTransaction).not.toHaveBeenCalled()
  })

  it('asks about a due item and confirms it with the real amount', async () => {
    const today = todayIso()
    mocks.listPlanned.mockResolvedValue([planned(7, today, { description: 'Rent' })])
    mocks.confirmPlanned.mockResolvedValue({ id: 1 })
    const user = renderOverview()
    expect(await screen.findByText('Did it happen?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    const amount = screen.getByLabelText('Actual amount')
    await user.clear(amount)
    await user.type(amount, '480')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.confirmPlanned).toHaveBeenCalledWith(7, { amount: 480, date: today }))
  })

  it('postpones or deletes a due item that did not happen', async () => {
    const today = todayIso()
    mocks.listPlanned.mockResolvedValue([planned(7, addDaysIso(today, -2)), planned(8, today)])
    mocks.postponePlanned.mockResolvedValue(planned(7, addDaysIso(today, 1)))
    mocks.deletePlanned.mockResolvedValue(undefined)
    const user = renderOverview()
    expect(await screen.findByText('2 days ago')).toBeInTheDocument()

    const [first, second] = screen.getAllByRole('button', { name: 'No' })
    await user.click(first)
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }))
    await waitFor(() => expect(mocks.postponePlanned).toHaveBeenCalledWith(7, addDaysIso(today, 1)))

    await user.click(second)
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => expect(mocks.deletePlanned).toHaveBeenCalled())
  })

  it('lists upcoming items, faded, and shows the month-end forecast', async () => {
    mocks.listPlanned.mockResolvedValue([planned(9, addDaysIso(todayIso(), 3), { description: 'Insurance' })])
    mocks.getForecast.mockResolvedValue({
      today: todayIso(), end_date: '2026-11-30', balance: 1000,
      planned_income: 200, planned_expense: 500, expected_balance: 700, item_count: 2,
    })
    renderOverview()
    const row = await screen.findByRole('button', { name: 'Edit planned Insurance' })
    expect(row).toHaveClass('txn-planned')
    expect(within(row).getByText(/In 3 days/)).toBeInTheDocument()
    const forecast = await screen.findByRole('region', { name: 'End of month forecast' })
    expect(forecast).toHaveTextContent('$700.00')
    expect(forecast).toHaveTextContent('−$500.00')
    expect(screen.queryByText('Did it happen?')).not.toBeInTheDocument()
  })
})
