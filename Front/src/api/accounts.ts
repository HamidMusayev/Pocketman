import { apiClient } from './client'
import type { Account } from './types'

export async function listAccounts(): Promise<Account[]> {
  const res = await apiClient.get('/accounts')
  return res.data
}

export interface AccountInput {
  name: string
  type: string
  icon: string
  opening_balance?: number
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const res = await apiClient.post('/accounts', input)
  return res.data
}

export async function updateAccount(id: number, patch: Partial<AccountInput>): Promise<Account> {
  const res = await apiClient.put(`/accounts/${id}`, patch)
  return res.data
}

/** `moveTo`: the account that takes over this one's transactions, recurring
 * rules and starting balance (needed when the account has history). */
export async function deleteAccount(id: number, moveTo?: number): Promise<void> {
  await apiClient.delete(`/accounts/${id}`, moveTo ? { params: { move_to: moveTo } } : undefined)
}
