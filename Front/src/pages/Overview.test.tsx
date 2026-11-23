import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PeriodProvider } from '../context/PeriodContext'
import { renderWithProviders } from '../test-utils'
import { Overview } from './Overview'

const mocks = vi.hoisted(() => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
}))

vi.mock('../api/transactions', () => ({
  listTransactions: mocks.listTransactions,
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
  getBudgetSummary: vi.fn(),
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

vi.mock('../api/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    accent_color: '#FCD535',
    currency_symbol: '$',
    show_cents: true,
  }),
  updateSettings: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

describe('Overview add-transaction form', () => {
  it('posts a transaction with the chosen category, amount and default account', async () => {
    mocks.listTransactions.mockResolvedValue([])
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

    await user.type(screen.getByPlaceholderText('0.00'), '12')
    await user.click(foodChip)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mocks.createTransaction).toHaveBeenCalledTimes(1))
    expect(mocks.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amount: 12,
        description: 'Food',
        category_id: 1,
        account_id: 5,
      }),
    )
  })
})
