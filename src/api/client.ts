const BASE_URL = (import.meta as ImportMeta).env?.VITE_API_BASE || '/api'

import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './tokens'
import { useAuthStore } from '../stores/auth'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)
  return m && m[1] !== undefined ? decodeURIComponent(m[1]) : undefined
}

function shouldAttemptRefresh(path: string): boolean {
  // Avoid recursion / redundant refresh attempts on auth endpoints themselves.
  const normalized = path.startsWith('/') ? path : `/${path}`
  return !['/auth/login', '/auth/register', '/auth/refresh'].some(
    (p) => normalized === p || normalized.startsWith(`${p}/`),
  )
}

async function tryRefresh(headers: Record<string, string>): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  const csrf = getCsrfToken()
  const refreshHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...headers,
  }
  if (csrf) refreshHeaders['X-CSRFToken'] = csrf

  const res = await fetch(`${BASE_URL}/auth/refresh/`, {
    method: 'POST',
    headers: refreshHeaders,
    credentials: 'include',
    body: JSON.stringify({ refresh }),
  })

  if (!res.ok) return false
  const data = (await res.json().catch(() => null)) as {
    access?: unknown
    refresh?: unknown
  } | null
  if (!data || typeof data.access !== 'string') return false

  setAccessToken(data.access)
  if (typeof data.refresh === 'string' && data.refresh.length > 0) setRefreshToken(data.refresh)
  return true
}

async function request<T>(path: string, options: RequestInit = {}, hasRetried = false): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  }

  const access = getAccessToken()
  if (access) headers['Authorization'] = `Bearer ${access}`

  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCsrfToken()
    if (csrf) headers['X-CSRFToken'] = csrf
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    headers,
    credentials: 'include',
    ...options,
  })

  if (res.status === 401 && !hasRetried && shouldAttemptRefresh(path)) {
    const refreshed = await tryRefresh(headers).catch(() => false)
    if (refreshed) {
      const updatedAccess = getAccessToken()
      if (updatedAccess) headers['Authorization'] = `Bearer ${updatedAccess}`
      res = await fetch(`${BASE_URL}${path}`, {
        headers,
        credentials: 'include',
        ...options,
      })
    } else {
      // If refresh fails, force logout
      try {
        const auth = useAuthStore()
        auth.logout()
      } catch (e) {
        // ignore if store not available
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  // Empty responses
  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}

export const http = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export const endpoints = {
  tasks: '/tasks/',
  focusSessions: '/focus-sessions/',
  daySummaries: '/day-summaries/',
  blocks: '/blocks/',

  setting: '/setting/',
  notes: '/notes/',

  authRegister: '/auth/register/',
  authLogin: '/auth/login/',
  authRefresh: '/auth/refresh/',
  authMe: '/auth/me/',
}

export default { http, endpoints }
