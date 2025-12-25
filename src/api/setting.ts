import { endpoints, http } from './client'
import type { Paginated, Setting } from '../types'

export type UpdateSettingPayload = Partial<Pick<Setting, 'day_bounds' | 'column_colors'>>

type SettingListResponse = Setting | Setting[] | Paginated<Setting>

function extractSetting(res: SettingListResponse): Setting | null {
  if (!res) return null
  if (Array.isArray(res)) return res[0] ?? null
  if (typeof res === 'object' && 'results' in res) {
    const r = (res as Paginated<Setting>).results
    return Array.isArray(r) ? (r[0] ?? null) : null
  }
  return res as Setting
}

function isHttpStatus(err: unknown, status: number): boolean {
  return err instanceof Error && err.message.includes(`HTTP ${status} `)
}

export async function getSetting() {
  const res = await http.get<SettingListResponse>(endpoints.setting)
  return extractSetting(res)
}

export async function createSetting(payload: UpdateSettingPayload) {
  return http.post<Setting>(endpoints.setting, payload)
}

export async function updateSetting(payload: UpdateSettingPayload) {
  try {
    try {
      return await http.patch<Setting>(endpoints.setting, payload)
    } catch (e: unknown) {
      if (!isHttpStatus(e, 405)) throw e
      return await http.put<Setting>(endpoints.setting, payload)
    }
  } catch (e: unknown) {
    if (!isHttpStatus(e, 404) && !isHttpStatus(e, 405)) throw e

    const existing = await getSetting().catch(() => null)
    if (!existing) {
      return await createSetting(payload)
    }

    const detailUrl = `${endpoints.setting}${existing.id}/`
    try {
      return await http.patch<Setting>(detailUrl, payload)
    } catch (e2: unknown) {
      if (!isHttpStatus(e2, 405)) throw e2
      return await http.put<Setting>(detailUrl, payload)
    }
  }
}
