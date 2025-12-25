import { endpoints, http } from './client'
import { getRefreshToken, setAccessToken, setRefreshToken } from './tokens'

export type AuthTokenPair = {
  refresh: string
  access: string
}

export type AuthTokenResponse = AuthTokenPair & {
  user?: AuthUser
}

export type AuthUser = {
  id?: number
  username?: string
  email?: string
  [key: string]: unknown
}

export type AuthLoginPayload = {
  username?: string
  email?: string
  password: string
}

export type AuthRegisterPayload = {
  username: string
  email: string
  password: string
  password_confirm: string
}

export async function login(payload: AuthLoginPayload) {
  return http.post<AuthTokenResponse>(endpoints.authLogin, payload)
}

export async function register(payload: AuthRegisterPayload) {
  return http.post<AuthTokenResponse>(endpoints.authRegister, payload)
}

export async function refresh() {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('No refresh token available')

  const res = await http.post<{ access: string; refresh?: string }>(endpoints.authRefresh, {
    refresh,
  })
  setAccessToken(res.access)
  if (typeof res.refresh === 'string' && res.refresh.length > 0) setRefreshToken(res.refresh)
  return res
}

export async function me() {
  return http.get<AuthUser>(endpoints.authMe)
}
