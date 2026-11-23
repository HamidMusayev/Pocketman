import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'pocketman_token'
export const USERNAME_STORAGE_KEY = 'pocketman_username'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const PUBLIC_PATHS = ['/login', '/register']

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const onPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))
    if (error.response?.status === 401 && !onPublicPage) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USERNAME_STORAGE_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '')
  }
  return fallback
}
