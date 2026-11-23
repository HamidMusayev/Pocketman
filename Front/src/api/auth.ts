import { apiClient } from './client'

export interface AuthResponse {
  token: string
  username: string
}

export async function getAuthStatus(): Promise<{ registration_enabled: boolean }> {
  const res = await apiClient.get('/auth/status')
  return res.data
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/register', { username, password })
  return res.data
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/login', { username, password })
  return res.data
}

export async function getMe(): Promise<{ id: number; username: string }> {
  const res = await apiClient.get('/auth/me')
  return res.data
}

/** Returns a fresh token: every token issued before the change is revoked. */
export async function changePassword(current_password: string, new_password: string): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/change-password', { current_password, new_password })
  return res.data
}

export async function changeUsername(new_username: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/change-username', { new_username, password })
  return res.data
}

/** Signs out every other device; returns a fresh token for this one. */
export async function logoutAll(): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/logout-all')
  return res.data
}
