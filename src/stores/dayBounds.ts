import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type DayBounds = {
  wake: string // HH:MM
  sleep: string // HH:MM
}

const STORAGE_KEY = 'lma.dayBounds'

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function isDayBounds(value: unknown): value is DayBounds {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.wake === 'string' && typeof v.sleep === 'string'
}

export const useDayBoundsStore = defineStore('day-bounds', () => {
  const bounds = ref<DayBounds | null>(null)

  // Load from localStorage (supports old per-day format too)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = safeParseJson<unknown>(raw)

    // New format: { wake, sleep }
    if (isDayBounds(parsed)) {
      bounds.value = parsed
    }

    // Old format: { [date]: { wake, sleep } }
    if (bounds.value === null && parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      const keys = Object.keys(obj)
      if (keys.length > 0) {
        const first = obj[keys[0]!]
        if (isDayBounds(first)) {
          bounds.value = first
        }
      }
    }
  } catch {
    // ignore storage errors (e.g., SSR)
  }

  watch(bounds, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      // ignore
    }
  })

  function get(): DayBounds | null {
    return bounds.value
  }

  function set(next: DayBounds) {
    bounds.value = next
  }

  function clear() {
    bounds.value = null
  }

  return {
    bounds,
    get,
    set,
    clear,
  }
})
