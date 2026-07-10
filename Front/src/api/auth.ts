import { apiClient } from './client'

export async function getAuthStatus(): Promise<{ setup_complete: boolean }> {
  const res = await apiClient.get('/auth/status')
  return res.data
}

export async function setupPassword(password: string): Promise<{ token: string }> {
  const res = await apiClient.post('/auth/setup', { password })
  return res.data
}

export async function login(password: string): Promise<{ token: string }> {
  const res = await apiClient.post('/auth/login', { password })
  return res.data
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await apiClient.post('/auth/change-password', { current_password, new_password })
}
