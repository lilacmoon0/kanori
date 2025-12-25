import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { TaskStatus } from '../types'

import { useAuthStore } from './auth'
import { getSetting, updateSetting } from '../api/setting'

const STATUS_ORDER: TaskStatus[] = ['todo', 'doing', 'today', 'done']

function indexForStatus(status: TaskStatus | string): number {
  const idx = STATUS_ORDER.indexOf(status as TaskStatus)
  return idx >= 0 ? idx : -1
}

function normalizeColorArray(value: unknown): (string | null)[] {
  if (!Array.isArray(value)) return [null, null, null, null]
  const out: (string | null)[] = [null, null, null, null]
  for (let i = 0; i < out.length; i++) {
    const v = value[i]
    out[i] = typeof v === 'string' && v.length > 0 ? v : null
  }
  return out
}

export const useColumnsStore = defineStore('columns', () => {
  const authStore = useAuthStore()

  const colors = ref<(string | null)[]>([null, null, null, null])

  const defaults = ref<(string | null)[]>([null, null, null, null])

  const didHydrate = ref(false)

  async function hydrateFromApi() {
    if (!authStore.isAuthenticated) return
    const setting = await getSetting().catch(() => null)
    if (!setting) return

    const fromApi = normalizeColorArray(setting.column_colors)
    colors.value = fromApi.map((c, i) => {
      const def = defaults.value[i]
      if (def && c && c.toLowerCase() === def.toLowerCase()) return null
      return c
    })
  }

  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed) return
      if (didHydrate.value) return
      didHydrate.value = true
      void hydrateFromApi()
    },
    { immediate: true },
  )

  function buildApiArray(): string[] | null {
    const out: string[] = []
    for (let i = 0; i < STATUS_ORDER.length; i++) {
      const v = colors.value[i]
      if (typeof v === 'string' && v.length > 0) {
        out[i] = v
        continue
      }
      const def = defaults.value[i]
      if (typeof def === 'string' && def.length > 0) {
        out[i] = def
        continue
      }
      return null
    }
    return out
  }

  async function persistToApi() {
    if (!authStore.isAuthenticated) return
    const payload = buildApiArray()
    if (!payload) {
      console.warn('Column defaults not registered yet; skipping column_colors sync')
      return
    }
    await updateSetting({ column_colors: payload })
  }

  function registerDefaultColor(status: TaskStatus, color: string) {
    const idx = indexForStatus(status)
    if (idx < 0) return
    if (!color) return
    defaults.value[idx] = color

    const current = colors.value[idx]
    if (current && current.toLowerCase() === color.toLowerCase()) {
      colors.value[idx] = null
    }
  }

  function setColor(status: TaskStatus | string, color: string | null) {
    const idx = indexForStatus(status)
    if (idx < 0) return
    colors.value[idx] = color && color.length > 0 ? color : null
    void persistToApi().catch((e: unknown) => {
      console.error('Failed to save column colors to setting endpoint:', e)
    })
  }

  function getColor(status: TaskStatus | string) {
    return computed(() => {
      const idx = indexForStatus(status)
      if (idx < 0) return ''
      return colors.value[idx] ?? ''
    })
  }

  return { colors, defaults, registerDefaultColor, setColor, getColor, hydrateFromApi }
})
